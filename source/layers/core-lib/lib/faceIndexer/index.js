// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const CRYPTO = require('node:crypto');
const {
  RekognitionClient,
  DeleteFacesCommand,
  IndexFacesCommand,
  ListFacesCommand,
  DescribeCollectionCommand,
} = require('@aws-sdk/client-rekognition');
const xraysdkHelper = require('../xraysdkHelper');
const retryStrategyHelper = require('../retryStrategyHelper');
const {
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
  DynamoDB: {
    FaceIndexer: {
      Table,
      PartitionKey,
    },
  },
} = require('../environment');
const {
  M2CException,
} = require('../error');
const DB = require('../db');
const ValidationHelper = require('../validationHelper');
const {
  Version,
  Actions: {
    Tagging,
    Deleting,
  },
} = require('./defs');

const DEFAULT_FIELDS = [
  'faceId',
  'uuid',
  'collectionId',
  'externalImageId',
  'celeb',
  'key',
  'timestamp',
  'fullImageKey',
];
const DETECTION_ATTRIBUTES = [
  'GENDER',
  'AGE_RANGE',
  'FACE_OCCLUDED',
];

// ver:uuid:timestamp
const REGEX_EXTERNAL_IMAGE_ID = new RegExp(`^${Version}:[a-f0-9]{32}:[0-9]+$`);
const REGEX_HEXSTR = /^[a-f0-9]{6,}$/;

const THRESHOLD_USE_SFN_IMPORT_FACES = 250;
const THRESHOLD_PERCENTAGE = 10;

async function _runCommand(command) {
  const rekognitionClient = xraysdkHelper(new RekognitionClient({
    customUserAgent: CustomUserAgent,
    retryStrategy: retryStrategyHelper(),
  }));

  return rekognitionClient.send(command)
    .catch((e) => {
      if ((command.input || {}.Image || {}).Bytes !== undefined) {
        delete command.input.Image.Bytes;
      }
      console.error(
        'ERR:',
        '_runCommand:',
        command.constructor.name,
        e.$metadata.httpStatusCode,
        e.name,
        e.message,
        JSON.stringify(command.input)
      );
      throw e;
    });
}

async function _batchDeleteFacesFromCollections(collectionMap) {
  const ids = Object.keys(collectionMap);

  let promises = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const faceIds = collectionMap[id];

    if (faceIds.length > 0) {
      promises.push(_deleteFacesFromCollection(id, faceIds));
    }

    // limit of 5 TPS
    if (promises.length > 5) {
      await Promise.all(promises);
      promises = [];
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

async function _deleteFacesFromCollection(collectionId, faceIds) {
  const command = new DeleteFacesCommand({
    CollectionId: collectionId,
    FaceIds: faceIds,
  });

  return _runCommand(command)
    .catch(() =>
      undefined);
}

class FaceIndexer {
  constructor() {
    this.$metric = {
      facesIndexed: 0,
      apiCount: 0,
    };
    this.$itemsCached = {};
  }

  get metric() {
    return this.$metric;
  }

  get facesIndexed() {
    return this.metric.facesIndexed;
  }

  set facesIndexed(val) {
    this.metric.facesIndexed = val;
  }

  get apiCount() {
    return this.metric.apiCount;
  }

  set apiCount(val) {
    this.metric.apiCount = val;
  }

  get itemsCached() {
    return this.$itemsCached;
  }

  async indexFaces(
    collectionId,
    externalImageId,
    bytes,
    maxFaces = 20
  ) {
    const command = new IndexFacesCommand({
      CollectionId: collectionId,
      Image: {
        Bytes: bytes,
      },
      ExternalImageId: externalImageId,
      MaxFaces: maxFaces,
      QualityFilter: 'HIGH',
      DetectionAttributes: DETECTION_ATTRIBUTES,
    });
    return _runCommand(command)
      .then((res) => {
        this.apiCount += 1;
        this.facesIndexed += (res.FaceRecords || []).length;
        delete res.$metadata;
        return res;
      })
      .catch(() =>
        undefined);
  }

  async registerFace(faceId, fields) {
    const _fields = {
      timestamp: Date.now(),
      ...fields,
    };

    const db = new DB({
      Table,
      PartitionKey,
    });

    return db.update(
      faceId,
      undefined,
      _fields,
      false
    ).then(() =>
      _fields);
  }

  async batchGet(faceIds, fieldsToGet = []) {
    const cached = Object.keys(this.itemsCached);

    let _faceIds = [
      ...new Set(faceIds),
    ];

    _faceIds = faceIds
      .filter((id) =>
        !cached.includes(id));

    if (_faceIds.length === 0) {
      return [];
    }

    let _fieldsToGet = DEFAULT_FIELDS;
    if (fieldsToGet.length > 0) {
      _fieldsToGet = [
        ...new Set(fieldsToGet.concat('faceId')),
      ];
    }

    // query from db table
    const db = new DB({
      Table,
      PartitionKey,
    });

    return db.batchGet(_faceIds, _fieldsToGet)
      .then((res) => {
        res.forEach((x) => {
          this.itemsCached[x.faceId] = x;
        });
        return res;
      });
  }

  async batchUpdate(items) {
    const updateItems = [];
    const deleteItems = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.faceId || !ValidationHelper.validateUuid(item.faceId)) {
        throw new M2CException('invalid faceId');
      }
      if (item.action === Tagging) {
        if (!item.celeb || !ValidationHelper.validateCharacterSet(item.celeb)) {
          throw new M2CException('invalid celeb');
        }
        updateItems.push({
          faceId: item.faceId,
          celeb: item.celeb,
        });
      } else if (item.action === Deleting) {
        deleteItems.push({
          faceId: item.faceId,
        });
      } else {
        throw new M2CException('invalid action');
      }
    }

    if ((updateItems.length + deleteItems.length) === 0) {
      return undefined;
    }

    let promises = [];

    const db = new DB({
      Table,
      PartitionKey,
    });

    // update db record only if faceId already exists
    if (updateItems.length > 0) {
      const conditions = updateItems
        .map((_) =>
          'attribute_exists(faceId) AND (attribute_not_exists(faceId) OR #celeb <> :celeb)');

      promises.push(db.batchUpdateWithConditions(
        updateItems,
        conditions
      ).then((res) => ({
        updated: res,
      })));
    }

    // delete db record only if celeb field not exists
    if (deleteItems.length > 0) {
      const conditions = deleteItems
        .map((_) =>
          'attribute_not_exists(celeb)');
      const pKeys = deleteItems
        .map((x) =>
          x.faceId);
      promises.push(db.batchDeleteWithConditions(
        pKeys,
        conditions
      ).then((res) => ({
        deleted: res,
      })));
    }

    promises = await Promise.all(promises);

    promises = promises
      .reduce((a0, c0) => ({
        ...a0,
        ...c0,
      }));

    // remove faces from face collection as well
    if (promises.deleted && promises.deleted.length > 0) {
      const facesInCollection = {};

      promises.deleted
        .forEach((item) => {
          if (!item.collectionId || !item.faceId) {
            return;
          }
          if (facesInCollection[item.collectionId] === undefined) {
            facesInCollection[item.collectionId] = [item.faceId];
          } else {
            facesInCollection[item.collectionId].push(item.faceId);
          }
        });

      await _batchDeleteFacesFromCollections(facesInCollection);
    }

    return promises;
  }

  async importFaces(collectionId, token) {
    // get face count in collection
    let command = new DescribeCollectionCommand({
      CollectionId: collectionId,
    });

    let response = await _runCommand(command)
      .catch(() =>
        undefined);
    if (response === undefined) {
      return response;
    }

    let maxResults = THRESHOLD_USE_SFN_IMPORT_FACES;
    if (response.FaceCount > maxResults) {
      let diff = response.FaceCount - maxResults;
      diff = Math.round((diff / maxResults) * 100);

      if (diff <= THRESHOLD_PERCENTAGE) {
        maxResults = response.FaceCount;
      }
    }

    let nextToken;
    // get faces and convert to faceindexer payload
    const params = {
      CollectionId: collectionId,
      MaxResults: maxResults,
    };
    if (token) {
      params.NextToken = token;
    }

    command = new ListFacesCommand(params);

    response = await _runCommand(command)
      .then((res) => {
        const faces = [];

        res.Faces.forEach((face) => {
          const name = FaceIndexer.resolveExternalImageId(face.ExternalImageId);
          faces.push({
            collectionId,
            faceId: face.FaceId,
            externalImageId: face.ExternalImageId,
            userId: face.UserId,
            timestamp: Date.now(),
            celeb: name,
          });
        });

        nextToken = res.NextToken;
        return faces;
      });

    // batch write to faceindexer table
    const db = new DB({
      Table,
      PartitionKey,
    });

    // return {processed, unprocessed, token}
    return db.batchWrite(response)
      .then((res) => ({
        ...res,
        token: nextToken,
      }));
  }

  lookup(faceId) {
    return this.itemsCached[faceId];
  }

  // external image id
  static createExternalImageId(
    uuid,
    timestamp
  ) {
    const _uuid = uuid.replaceAll('-', '');
    const _timestamp = String(timestamp);

    return [
      Version,
      _uuid,
      _timestamp,
    ].join(':');
  }

  static isExternalImageIdCompatible(id = '') {
    return REGEX_EXTERNAL_IMAGE_ID.test(id);
  }

  static resolveExternalImageId(id, defaultTo = false) {
    if (FaceIndexer.isExternalImageIdCompatible(id)) {
      if (typeof defaultTo === 'string') {
        return defaultTo;
      }
      if (defaultTo === true) {
        return id;
      }
      return undefined;
    }

    let name = id;
    // some verison of m2c may store hex string format for
    // unicoded names
    if (REGEX_HEXSTR.test(name)) {
      name = Buffer.from(name, 'hex')
        .toString('utf8');
    }

    // some version of m2c may store ascii name
    // in first_last format - Jane_Doe
    name = name.replace(/_/g, ' ')
      .replace(/\b\w/g, (c) =>
        c.toUpperCase());

    return name;
  }

  static faceIdToNumber(faceId) {
    return CRYPTO.createHash('md5')
      .update(faceId)
      .digest()
      .reduce((a0, c0) =>
        a0 + c0, 0);
  }
}

module.exports = FaceIndexer;
