// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  AnalysisTypes: {
    Shoppable,
  },
  DB,
  Indexer,
  CommonUtils,
} = require('core-lib');
const BaseState = require('../shared/baseState');

const INDEX = process.env.ENV_OPENSEARCH_INDEX;
const DDB_TABLE = process.env.ENV_SHOPPABLE_DDB;
const PRIKEY = 'uuid';

class StateSimilaritySearch extends BaseState {
  static canHandle(op) {
    return op === 'StateSimilaritySearch';
  }

  async process() {
    const {
      uuid,
      input: {
        destination: {
          prefix,
        },
      },
      data: {
        shoppable: {
          bucket: proxyBucket,
          prefix: shoppablePrefix,
          embeddings: output,
        },
        framesegmentation: {
          key: framesegmentationKey,
        },
        segment: {
          output: segmentMapKey,
        },
      },
    } = this.event;

    const framePrefix = PATH.parse(framesegmentationKey).dir;

    let promises = [];

    // download output files
    const embeddingsKey = PATH.join(shoppablePrefix, output);
    promises.push(_downloadJson(
      proxyBucket,
      embeddingsKey,
      'embeddings'
    ));
    promises.push(_downloadJson(
      proxyBucket,
      framesegmentationKey,
      'framesegmentation'
    ));
    promises.push(_downloadJsonFromMap(
      proxyBucket,
      segmentMapKey,
      'segment'
    ));

    promises = await Promise.all(promises);
    promises = promises.reduce((a0, c0) => ({
      ...a0,
      ...c0,
    }), {});

    const {
      embeddings,
      framesegmentation,
      segment,
    } = promises;

    // search similar items from vector store
    promises = this.searchSimilarItems(embeddings);

    const frameMap = {};
    framesegmentation.forEach((item) => {
      frameMap[item.name] = item;
    });

    const segmentMap = {};
    segment.Segments.forEach((item) => {
      if (item.ShotSegment !== undefined) {
        segmentMap[String(item.ShotSegment.Index)] = item;
      }
    });

    const items = await promises;
    items.shoppable = items.shoppable
      .filter((item) =>
        item.apparels.length > 0);

    let shotMap = {};
    items.shoppable.forEach((item) => {
      // look up frameNo and timestamp
      const frame = frameMap[item.file];
      item.frameNo = frame.frameNo;
      item.timestamp = frame.timestamp;

      const strIdx = String(frame.shotIdx);
      const shotFound = shotMap[strIdx];
      // does the shot exist?
      if (shotFound !== undefined) {
        // if so, does the apparel exist?
        item.apparels.forEach((apparel) => {
          const label = apparel.label;
          const asins = apparel.items
            .map((x) => ({
              asin: x.asin,
              score: x.score,
            }));

          const foundApparel = shotFound.apparels
            .find((x) =>
              x.label === label);

          // if apparel exists, add the new asins
          if (foundApparel !== undefined) {
            foundApparel.asins = foundApparel.asins.concat(asins);
          // otherwise, add new apparel label
          } else {
            shotFound.apparels.push({
              label,
              asins,
            });
          }
        });
      // if shot doesn't exist,...
      } else {
        const shot = segmentMap[strIdx];

        const apparelMap = {};
        item.apparels.forEach((apparel) => {
          const apparelItem = {
            label: apparel.label,
            asins: apparel.items
              .map((x) => ({
                asin: x.asin,
                score: x.score,
              })),
          };

          if (apparelMap[apparelItem.label] !== undefined) {
            apparelMap[apparelItem.label].asins
              = apparelMap[apparelItem.label].asins.concat(apparelItem.asins);
          } else {
            apparelMap[apparel.label] = apparelItem;
          }
        });
        shotMap[strIdx] = {
          shotIdx: frame.shotIdx,
          timeStart: shot.StartTimestampMillis,
          timeEnd: shot.EndTimestampMillis,
          frameStart: shot.StartFrameNumber,
          frameEnd: shot.EndFrameNumber,
          smpteStart: shot.StartTimecodeSMPTE,
          smpteEnd: shot.EndTimecodeSMPTE,
          duration: shot.DurationMillis,
          apparels: Object.values(apparelMap),
        };
      }
    });

    // now remove duplicated asins
    shotMap = Object.values(shotMap);
    shotMap.forEach((shot) => {
      shot.apparels.forEach((apparel) => {
        apparel.asins.sort((a, b) =>
          b.score - a.score);
        const asinMap = {};
        apparel.asins.forEach((asinItem) => {
          if (asinMap[asinItem.asin] === undefined) {
            asinMap[asinItem.asin] = asinItem;
          }
        });
        apparel.asins = Object.values(asinMap);
      });
    });

    items.shoppableBySegment = shotMap;
    items.framePrefix = framePrefix;

    // upload metadata
    const outPrefix = PATH.join(prefix, 'metadata', Shoppable);
    const name = `${Shoppable}.json`;

    promises = [];
    promises.push(CommonUtils.uploadFile(
      proxyBucket,
      outPrefix,
      name,
      items
    ));

    const data = this.event.data.shoppable;
    delete data.bucket;
    delete data.prefix;
    delete data.json;
    delete data.embeddings;
    delete data.simlarity;
    data.key = PATH.join(outPrefix, name);

    // update record
    const ddb = new DB({
      Table: DDB_TABLE,
      PartitionKey: PRIKEY,
    });

    promises.push(ddb.update(
      uuid,
      undefined,
      {
        [Shoppable]: data,
      },
      false
    ));

    await Promise.all(promises);

    return this.event;
  }

  async searchSimilarItems(docs) {
    const index = INDEX;
    const resultMap = {};

    const indexer = new Indexer();

    let response;

    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i];
      console.log(`=== [${i}] PROCESSING: ${doc.name}`);

      const query = {
        index,
        size: 10,
        body: {
          _source: {
            includes: [
              'asin',
              'file',
              'label',
              'score',
            ],
          },
          query: {
            knn: {
              embeddings: {
                vector: doc.embeddings,
                k: 10,
              },
            },
          },
        },
      };

      response = await indexer.search(query)
        .then((res) => {
          const hits = ((res.body || {}).hits || {}).hits || [];
          return hits;
        });

      if (response.length > 0) {
        // sort by score
        response.sort((a, b) =>
          b._source.score - a._source.score);

        if (resultMap[doc.name] === undefined) {
          resultMap[doc.name] = {
            file: doc.name,
            apparels: [],
          };
        }

        let items = {};
        response.forEach((item) => {
          if (doc.label !== item._source.label) {
            return;
          }

          const asin = item._source.asin;
          if (items[asin] === undefined) {
            items[asin] = {
              asin,
              score: Number(item._score.toFixed(4)),
              docId: item._id,
              label: {
                name: item._source.label,
                score: Number(item._source.score.toFixed(4)),
                file: item._source.file,
              },
            };
          }
        });

        items = Object.values(items);
        if (items.length > 0) {
          items.sort((a, b) =>
            b.score - a.score);

          resultMap[doc.name].apparels.push({
            box: doc.box,
            label: doc.label,
            score: Number(doc.score.toFixed(4)),
            items,
          });
        }
      }
    }

    return {
      [Shoppable]: Object.values(resultMap),
    };
  }
}

async function _downloadJsonFromMap(bucket, key, field) {
  const mapFile = await _downloadJson(bucket, key, 'tmp')
    .then((res) =>
      res.tmp);

  const parsed = PATH.parse(key);
  const json = PATH.join(parsed.dir, mapFile.file);

  return _downloadJson(bucket, json, field);
}

async function _downloadJson(bucket, key, field) {
  return CommonUtils.download(bucket, key)
    .then((res) => ({
      [field]: JSON.parse(res.toString()),
    }));
}

module.exports = StateSimilaritySearch;
