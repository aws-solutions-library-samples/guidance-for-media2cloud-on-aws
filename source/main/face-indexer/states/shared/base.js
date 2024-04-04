// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  Environment: {
    Proxy: {
      Bucket: ProxyBucket,
    },
    DynamoDB: {
      Ingest: {
        Table: IngestTable,
        PartitionKey: IngestPartitionKey,
      },
      AIML: {
        Table: AnalysisTable,
        PartitionKey: AnalysisPartitionKey,
        SortKey: AnalysisSortKey,
      },
    },
  },
  AnalysisTypes: {
    Rekognition: {
      FaceMatch,
    },
  },
  MapDataVersion,
  DB,
  Indexer,
  CommonUtils,
  WebVttHelper,
  FaceIndexer,
} = require('core-lib');

const INDEX = Indexer.getContentIndex();
const SUBFIELD = `${FaceMatch}.faceId`;
const TYPE_VIDEO = 'video';
const TYPE_IMAGE = 'image';
const SUPPORTED_MEDIA_TYPES = [
  TYPE_VIDEO,
  TYPE_IMAGE,
];
const SUBCATEGORY_REKOG_VIDEO = 'rekognition';
const SUBCATEGORY_REKOG_IMAGE = 'rekog-image';

const THRESHOLD_LAMBDA_TIMEOUT = 60 * 1000;

function _regroupMetadataDatapoints(source) {
  const grouping = {};

  const datapoints = Object.values(source)
    .flat(1);

  datapoints.forEach((datapoint) => {
    if (grouping[datapoint.name] === undefined) {
      grouping[datapoint.name] = [datapoint];
    } else {
      grouping[datapoint.name].push(datapoint);
      grouping[datapoint.name]
        .sort((a, b) =>
          a.begin - b.begin);
    }
  });

  return grouping;
}

function _regroupTimeseriesDatapoints(source, target) {
  const _source = source;

  const sourceXs = source.data
    .map((item) =>
      item.x);

  target.data.forEach((item) => {
    const idx = sourceXs.indexOf(item.x);

    if (idx >= 0) {
      const data = _source.data[idx];
      data.y += item.y;
      data.details = data.details
        .concat(item.details);
    } else {
      _source.data.push(item);
    }
  });

  // resort timestamp
  _source.data
    .sort((a, b) =>
      b.x - a.x);

  _source.appearance += target.appearance;

  return _source;
}

async function _downloadJson(bucket, key) {
  return CommonUtils.download(bucket, key)
    .then((res) =>
      JSON.parse(res))
    .catch(() =>
      undefined);
}

async function _uploadJson(bucket, prefix, name, data) {
  return CommonUtils.uploadFile(
    bucket,
    prefix,
    name,
    data
  ).then(() =>
    data);
}

class BaseState {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
    this.$faceIndexer = new FaceIndexer();

    let fn = () =>
      THRESHOLD_LAMBDA_TIMEOUT * 2;
    if (context && typeof context.getRemainingTimeInMillis === 'function') {
      fn = context.getRemainingTimeInMillis;
    }
    this.$fnGetRemainingTime = fn.bind();
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get faceIndexer() {
    return this.$faceIndexer;
  }

  async processWithUuid(uuid, updated = [], deleted = []) {
    // fetch content info
    const type = await this.getMediaType(uuid);
    if (!SUPPORTED_MEDIA_TYPES.includes(type)) {
      return undefined;
    }

    let category = SUBCATEGORY_REKOG_VIDEO;
    if (type === TYPE_IMAGE) {
      category = SUBCATEGORY_REKOG_IMAGE;
    }

    const analysis = await this.getAnalysisRecord(uuid, type, category);

    const facematch = ((analysis || {})[category] || {})[FaceMatch];
    if (facematch === undefined) {
      return undefined;
    }

    if (category === SUBCATEGORY_REKOG_IMAGE) {
      return this.processImageWithUuid(
        uuid,
        updated,
        deleted,
        facematch.output
      );
    }

    let promises = [];

    // update mapFile
    let mapData;
    if (facematch.output && /json$/.test(facematch.output)) {
      mapData = await this.updateMapDataFile(facematch.output, updated, deleted);
    }

    // update Rekog JSON response
    if (mapData !== undefined) {
      const parsed = PATH.parse(facematch.output);
      const jsonKey = PATH.join(parsed.dir, mapData.file);

      promises.push(this.updateRekognitionRawJsonResults(
        jsonKey,
        updated,
        deleted
      ));
    }

    // update timeseries, webvtt, metadata files
    promises.push(this.updateTimeseriesDataFile(
      facematch.timeseries,
      updated,
      deleted
    ));

    promises.push(this.updateWebVttFile(
      facematch.vtt,
      updated,
      deleted
    ));

    // opensearch document depends on the updated metadata file
    const metadata = await this.updateMetadataFile(
      facematch.metadata,
      updated,
      deleted
    );

    // update opensearch
    promises.push(this.updateOpenSearchDocument(
      uuid,
      metadata
    ));

    promises = await Promise.all(promises);

    return promises;
  }

  async processImageWithUuid(uuid, updated, deleted, jsonKey) {
    if (!jsonKey) {
      return undefined;
    }

    const parsed = PATH.parse(jsonKey);
    const prefix = parsed.dir;
    const name = parsed.base;

    // rekognition JSON output
    const json = await _downloadJson(ProxyBucket, jsonKey);
    if (!json) {
      return undefined;
    }

    const _mapUpdated = updated
      .reduce((a0, c0) => ({
        ...a0,
        [c0.faceId]: c0.celeb,
      }), {});
    const _mapDeleted = deleted
      .reduce((a0, c0) => ({
        ...a0,
        [c0.faceId]: true,
      }), {});

    const datapoints = [];

    json.FaceMatches.forEach((facematch) => {
      const faceId = (facematch.Face || {}).FaceId;
      if (!faceId) {
        return;
      }

      // add a new MarkDeleted field instead of deleting the entry
      if (_mapDeleted[faceId] !== undefined) {
        facematch.Face.MarkDeleted = true;
        return;
      }

      // rename Name field
      if (_mapUpdated[faceId] !== undefined) {
        facematch.Face.Name = _mapUpdated[faceId];
      }

      // save datapoint for opensearch later
      datapoints.push({
        faceId,
        name: facematch.Face.Name,
      });
    });

    let promises = [];

    promises.push(_uploadJson(ProxyBucket, prefix, name, json));

    // opensearch
    if (datapoints.length > 0) {
      const doc = {
        [FaceMatch]: datapoints,
      };

      const indexer = new Indexer();
      promises.push(indexer.update(INDEX, uuid, doc));
    }

    promises = await Promise.all(promises);

    return promises;
  }

  async getMediaType(uuid) {
    const db = new DB({
      Table: IngestTable,
      PartitionKey: IngestPartitionKey,
    });

    const fieldsToGet = [
      'type',
    ];

    return db.fetch(uuid, undefined, fieldsToGet)
      .then((res) =>
        res.type);
  }

  async getAnalysisRecord(uuid, type, category) {
    const db = new DB({
      Table: AnalysisTable,
      PartitionKey: AnalysisPartitionKey,
      SortKey: AnalysisSortKey,
    });

    return db.fetch(uuid, type, [category]);
  }

  async updateMapDataFile(key, updated = [], deleted = []) {
    const parsed = PATH.parse(key);
    const prefix = parsed.dir;
    const name = parsed.base;

    const mapData = await _downloadJson(ProxyBucket, key);

    if (!mapData || mapData.version === undefined || mapData.version < MapDataVersion) {
      return undefined;
    }

    let modified = mapData.data
      .reduce((a0, c0) => ({
        ...a0,
        [c0]: c0,
      }), {});

    deleted.forEach((item) => {
      delete modified[item.faceId];
    });

    updated.forEach((item) => {
      if (modified[item.faceId] !== undefined) {
        modified[item.faceId] = item.celeb;
      }
    });
    modified = [
      ...new Set(Object.values(modified)),
    ];

    mapData.lastmodified = Date.now();
    mapData.data = modified;

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      mapData
    );
  }

  async updateRekognitionRawJsonResults(key, updated = [], deleted = []) {
    if (!key) {
      return undefined;
    }

    const parsed = PATH.parse(key);
    const prefix = parsed.dir;
    const name = parsed.base;

    const json = await _downloadJson(ProxyBucket, key);
    if (!json) {
      return undefined;
    }

    const _mapUpdated = updated
      .reduce((a0, c0) => ({
        ...a0,
        [c0.faceId]: c0.celeb,
      }), {});
    const _mapDeleted = deleted
      .reduce((a0, c0) => ({
        ...a0,
        [c0.faceId]: true,
      }), {});

    json.Persons.forEach((person) => {
      person.FaceMatches.forEach((facematch) => {
        const faceId = facematch.Face.FaceId;
        // add a new instead of deleting the entry
        if (_mapDeleted[faceId] !== undefined) {
          facematch.Face.MarkDeleted = true;
        } else if (_mapUpdated[faceId] !== undefined) {
          facematch.Face.Name = _mapUpdated[faceId];
        }
      });
    });

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      json
    );
  }

  async updateMetadataFile(key, updated = [], deleted = []) {
    if (!key) {
      return undefined;
    }

    const parsed = PATH.parse(key);
    const prefix = parsed.dir;
    const name = parsed.base;

    let metadata = await _downloadJson(ProxyBucket, key);
    if (!metadata) {
      return undefined;
    }

    deleted.forEach((item) => {
      delete metadata[item.faceId];
    });

    updated.forEach((item) => {
      if (metadata[item.faceId]) {
        metadata[item.faceId]
          .forEach((datapoint) => {
            datapoint.name = item.celeb;
          });
      }
    });

    // regrouping datapoints as a name can be associated with multiple faceIds
    metadata = _regroupMetadataDatapoints(metadata);

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      metadata
    );
  }

  async updateTimeseriesDataFile(key, updated = [], deleted = []) {
    if (!key) {
      return undefined;
    }

    const parsed = PATH.parse(key);
    const prefix = parsed.dir;
    const name = parsed.base;

    const timeseries = await _downloadJson(ProxyBucket, key);
    if (!timeseries) {
      return undefined;
    }

    deleted.forEach((item) => {
      delete timeseries[item.faceId];
    });

    updated.forEach((item) => {
      // move from faceId to celeb
      if (timeseries[item.celeb] === undefined) {
        if (timeseries[item.faceId] !== undefined) {
          timeseries[item.celeb] = {
            ...timeseries[item.faceId],
            label: item.celeb,
          };
          delete timeseries[item.faceId];
          return;
        }
      }
      // merge datapoints
      if (timeseries[item.celeb] !== undefined) {
        timeseries[item.celeb] = _regroupTimeseriesDatapoints(
          timeseries[item.celeb],
          timeseries[item.faceId]
        );
        delete timeseries[item.faceId];
      }
    });

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      timeseries
    );
  }

  async updateWebVttFile(key, updated = [], deleted = []) {
    if (!key) {
      return undefined;
    }

    const parsed = PATH.parse(key);
    const prefix = parsed.dir;
    const name = parsed.base;

    const vtts = await _downloadJson(ProxyBucket, key);
    if (!vtts) {
      return undefined;
    }
    Object.keys(vtts)
      .forEach((x) => {
        vtts[x] = WebVttHelper.parse(vtts[x]);
      });

    deleted.forEach((item) => {
      delete vtts[item.faceId];
    });

    updated.forEach((item) => {
      // move from faceId to celeb
      if (vtts[item.celeb] === undefined) {
        if (vtts[item.faceId] !== undefined) {
          // replace faceId to celeb
          vtts[item.celeb] = vtts[item.faceId];
          vtts[item.celeb].cues.forEach((cue) => {
            cue.text = cue.text.replaceAll(item.faceId, item.celeb);
          });
          delete vtts[item.faceId];
          return;
        }
      }

      // merge cues
      if (vtts[item.faceId] !== undefined) {
        // replace faceId to celeb
        let cues = vtts[item.faceId].cues;
        cues.forEach((cue) => {
          cue.text = cue.text.replaceAll(item.faceId, item.celeb);
        });

        // merge, sort, and remap id
        cues = vtts[item.celeb].cues
          .concat(cues)
          .sort((a, b) =>
            a.start - b.start)
          .map((cue, idx) => ({
            ...cue,
            identifier: String(idx),
          }));

        vtts[item.celeb].cues = cues;
        delete vtts[item.faceId];
      }
    });

    // re-compiling the webvtt
    Object.keys(vtts)
      .forEach((item) => {
        // just in case, fix the start/end...
        const cues = vtts[item].cues
          .map((cue) => {
            if (((cue.end - cue.start) * 1000) <= 0) {
              cue.end += 0.5; // +500ms
            }
            return cue;
          });
        vtts[item] = WebVttHelper.compile(vtts[item]);
      });

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      vtts
    );
  }

  async updateOpenSearchDocument(uuid, metadata) {
    if (metadata === undefined) {
      return undefined;
    }

    const datapoints = [];

    Object.keys(metadata)
      .forEach((x) => {
        const item = metadata[x];
        if (item.length === 0) {
          return;
        }

        const name = item[0].name;
        const faceId = item[0].faceId;
        const timecodes = item
          .map((timecode) => ({
            begin: timecode.begin,
            end: timecode.end,
          }));
        datapoints.push({
          name,
          faceId,
          timecodes,
        });
      });

    if (datapoints.length === 0) {
      return undefined;
    }

    const doc = {
      [FaceMatch]: datapoints,
    };

    const indexer = new Indexer();

    return indexer.update(INDEX, uuid, doc);
  }

  async searchDocumentsByFaceIds(faceIds) {
    const matchTerms = faceIds
      .map((faceId) => ({
        match: {
          [SUBFIELD]: faceId,
        },
      }));

    const query = {
      index: INDEX,
      body: {
        _source: {
          includes: [
            '_id',
          ],
        },
        fields: [
          FaceMatch,
        ],
        query: {
          bool: {
            should: matchTerms,
          },
        },
      },
    };

    const indexer = new Indexer();

    return indexer.search(query)
      .then((res) => {
        const ids = res.body.hits.hits
          .map((x) =>
            x._id);
        return ids;
      })
      .catch((e) => {
        console.log('==== searchDocumentsByFaceIds', faceIds.join(', '));
        console.error(e);
        throw e;
      });
  }

  lambdaTimeout() {
    const remainingTime = this.$fnGetRemainingTime();
    return (remainingTime - THRESHOLD_LAMBDA_TIMEOUT) <= 0;
  }
}

module.exports = BaseState;
