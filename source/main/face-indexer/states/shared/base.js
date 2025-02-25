// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  parse,
  join,
} = require('node:path');
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
  CommonUtils: {
    download,
    uploadFile,
  },
  WebVttHelper: {
    parse: parseVtt,
    compile: compileVtt,
  },
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

function _mergeWebVttCues(source, target) {
  let cues = source.cues.concat(target.cues);

  const cueMap = {};
  for (const item of cues) {
    const strId = Buffer.from(JSON.stringify({
      start: item.start,
      end: item.end,
      styles: item.styles,
    })).toString('base64');

    if (cueMap[strId] === undefined) {
      cueMap[strId] = item;
    }
  }

  cues = Object.values(cueMap);
  cues.sort((a, b) =>
    a.start - b.start)
    .map((cue, idx) => ({
      ...cue,
      identifier: String(idx),
    }));

  return cues;
}

function _mergeMetadataData(source, target) {
  let data = source.concat(target);

  const dataMap = {};
  for (const item of data) {
    const strId = Buffer.from(JSON.stringify({
      begin: item.begin,
      end: item.end,
      cx: item.cx,
      cy: item.cy,
    })).toString('base64');

    if (dataMap[strId] === undefined) {
      dataMap[strId] = item;
    }
  }

  data = Object.values(dataMap);
  data.sort((a, b) =>
    a.begin - b.begin);

  return data;
}

function _mergeTimeseriesDatapoints(source, target) {
  let data = source.data.concat(target.data);

  const dataMap = {};
  for (const item of data) {
    const strId = String(item.x);
    if (dataMap[strId] === undefined) {
      dataMap[strId] = {
        x: item.x,
        y: 0,
        details: [],
      };
    }

    const details = _mergeTimeseriesDatapointDetails(dataMap[strId].details, item.details);
    dataMap[strId].details = details
    dataMap[strId].y = details.length;
  }

  data = Object.values(dataMap);
  data.sort((a, b) =>
    a.x - b.x);

  source.data = data;

  // recalculate appearance
  let appearance = source.appearance || 0;
  if (target.appearance !== undefined) {
    appearance = Math.max(appearance, target.appearance);
  }
  source.appearance = appearance;

  return source;
}

function _mergeTimeseriesDatapointDetails(source, target) {
  let data = source.concat(target);

  const dataMap = {};
  for (const item of data) {
    const strId = Buffer.from(JSON.stringify({
      l: item.l,
      t: item.t,
      w: item.w,
      h: item.h,
    })).toString('base64');

    if (dataMap[strId] === undefined) {
      dataMap[strId] = item;
    }
  }

  data = Object.values(dataMap);

  return data;

}

async function _downloadJson(bucket, key) {
  return download(bucket, key)
    .then((res) =>
      JSON.parse(res))
    .catch(() =>
      undefined);
}

async function _uploadJson(bucket, prefix, name, data) {
  return uploadFile(
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
      const parsed = parse(facematch.output);
      const jsonKey = join(parsed.dir, mapData.file);

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
    let metadata;
    promises.push(this.updateMetadataFile(
      facematch.metadata,
      updated,
      deleted
    ).then((res) =>
      metadata = res));

    promises = await Promise.all(promises);

    // update opensearch
    promises = await this.updateOpenSearchDocument(
      uuid,
      metadata
    );

    return promises;
  }

  async processImageWithUuid(uuid, updated, deleted, jsonKey) {
    if (!jsonKey) {
      return undefined;
    }

    const { dir: prefix, base: name } = parse(key);

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
    const { dir: prefix, base: name } = parse(key);

    const mapData = await _downloadJson(ProxyBucket, key);

    if (!mapData || mapData.version === undefined || mapData.version < MapDataVersion) {
      return undefined;
    }

    let faceMap = {};
    for (const item of mapData.data) {
      faceMap[item] = item;
    }

    for (const { faceId } of deleted) {
      delete faceMap[faceId];
    }

    for (const { faceId, celeb, updateFrom } of updated) {
      if (faceMap[faceId] !== undefined) {
        faceMap[faceId] = celeb;
      }
      if (faceMap[updateFrom] !== undefined) {
        faceMap[updateFrom] = celeb;
      }
    }

    faceMap = [...new Set(Object.values(faceMap))];

    mapData.lastmodified = Date.now();
    mapData.data = faceMap;

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

    const { dir: prefix, base: name } = parse(key);

    const data = await _downloadJson(ProxyBucket, key);
    if (!data) {
      return undefined;
    }

    let faceIdsToDelete = [];
    for (const { faceId } of deleted) {
      if (faceId) {
        faceIdsToDelete.push(faceId);
      }
    }
    faceIdsToDelete = [...new Set(faceIdsToDelete)];

    const updateMap = {};
    for (const { faceId, updateFrom, celeb } of updated) {
      updateMap[faceId] = celeb;
      updateMap[updateFrom] = celeb;
    }

    for (const { FaceMatches: faceMatches = [] } of data.Persons) {
      for (const { Face: face = {} } of faceMatches) {
        // process delete action
        if (faceIdsToDelete.includes(face.FaceId)) {
          face.MarkDeleted = true;
        } else if (updateMap[face.FaceId] !== undefined) {
          face.Name = updateMap[face.FaceId];
        } else if (updateMap[face.Name] !== undefined) {
          face.Name = updateMap[face.FaceId];
        }
      }
    }

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      data
    );
  }

  async updateMetadataFile(key, updated = [], deleted = []) {
    if (!key) {
      return undefined;
    }

    const { dir: prefix, base: name } = parse(key);

    let dataMap = await _downloadJson(ProxyBucket, key);
    if (!dataMap) {
      return undefined;
    }

    // process delete action first
    for (const { faceId } of deleted) {
      delete dataMap[faceId];
    }

    // move keys from faceIds or oldName to new celeb name
    for (const { faceId, updateFrom, celeb } of updated) {
      // the new name already contains data
      const mergeRequired = dataMap[celeb];

      for (const k of [faceId, updateFrom]) {
        if (dataMap[k] !== undefined) {
          // update celeb name
          for (const item of dataMap[k]) {
            item.name = celeb;
          }
          dataMap[celeb] = dataMap[k];
          delete dataMap[k];
        }
      }

      // merge datapoints
      if (mergeRequired !== undefined && dataMap[celeb] !== undefined) {
        const datapoints = _mergeMetadataData(mergeRequired, dataMap[celeb]);
        dataMap[celeb] = datapoints;
      }
    }

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      dataMap
    );
  }

  async updateTimeseriesDataFile(key, updated = [], deleted = []) {
    if (!key) {
      return undefined;
    }

    const { dir: prefix, base: name } = parse(key);

    let dataMap = await _downloadJson(ProxyBucket, key);
    if (!dataMap) {
      return undefined;
    }

    // process delete action first
    for (const { faceId } of deleted) {
      delete dataMap[faceId];
    }

    // move keys from faceIds or oldName to new celeb name
    for (const { faceId, updateFrom, celeb } of updated) {
      // the new name already contains data
      const mergeRequired = dataMap[celeb];

      for (const k of [faceId, updateFrom]) {
        if (dataMap[k] !== undefined) {
          // update celeb name
          dataMap[k].label = celeb;
          dataMap[celeb] = dataMap[k];
          delete dataMap[k];
        }
      }

      // merge datapoints
      if (mergeRequired !== undefined && dataMap[celeb] !== undefined) {
        const datapoints = _mergeTimeseriesDatapoints(mergeRequired, dataMap[celeb]);
        dataMap[celeb] = datapoints;
      }
    }

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      dataMap
    );
  }

  async updateWebVttFile(key, updated = [], deleted = []) {
    if (!key) {
      return undefined;
    }

    const { dir: prefix, base: name } = parse(key);

    let vttMap = await _downloadJson(ProxyBucket, key);
    if (!vttMap) {
      return undefined;
    }

    // process delete action first
    for (const { faceId } of deleted) {
      delete vttMap[faceId];
    }

    for (const [key, value] of Object.entries(vttMap)) {
      vttMap[key] = parseVtt(value);
    }

    // move keys from faceIds or oldName to new celeb name
    for (const { faceId, updateFrom, celeb } of updated) {
      // the new name already contains data
      const mergeRequired = vttMap[celeb];

      for (const k of [faceId, updateFrom]) {
        if (vttMap[k] !== undefined) {
          // update celeb name
          for (const cue of vttMap[k].cues) {
            cue.text = cue.text.replaceAll(k, celeb);
          }
          // remap
          vttMap[celeb] = vttMap[k];
          delete vttMap[k];
        }
      }

      // merge datapoints
      if (mergeRequired !== undefined && vttMap[celeb] !== undefined) {
        const cues = _mergeWebVttCues(mergeRequired, vttMap[celeb]);
        vttMap[celeb].cues = cues;
      }
    }

    // now, recompile the webvtt track
    for (const [key, value] of Object.entries(vttMap)) {
      // just in case, patching the start/end timestamps
      for (const cue of value.cues) {
        if ((cue.end - cue.start) <= 0.10) {
          cue.end += 0.5;
        }
      }
      vttMap[key] = compileVtt(value);
    }

    return _uploadJson(
      ProxyBucket,
      prefix,
      name,
      vttMap
    );
  }

  async updateOpenSearchDocument(uuid, metadata) {
    if (uuid === undefined || metadata === undefined) {
      return undefined;
    }

    const datapoints = [];

    for (const [name, value] of Object.entries(metadata)) {
      if (value.length > 0) {
        const timecodes = [];
        for (const { begin, end } of value) {
          timecodes.push({ begin, end });
        }
        const faceId = value[0].faceId;
        datapoints.push({ name, faceId, timecodes });
      }
    }

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
        const ids = ((((res || {}).body || {}).hits || {}).hits || [])
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
