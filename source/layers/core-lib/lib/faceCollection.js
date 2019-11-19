/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */


/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
const AWS = require('aws-sdk');
const URL = require('url');
const PATH = require('path');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
];

const MAX_RETRIES = 5;

const TAG_MODE_MANUAL = 'manual';
const TAG_MODE_GROUNDTRUTH = 'groundtruth'; // eslint-disable-line

const QUEUED_FACE_EXPIRE_IN_DAYS = 7;

const {
  Environment,
} = require('./index');

const {
  DB,
} = require('./db');

const {
  mxCommonUtils,
} = require('./mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

/**
 * @class FaceCollection
 */
class FaceCollection {
  constructor(collectionId, data) {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);

    if (missing.length) {
      throw new Error(`missing enviroment variables, ${missing.join(', ')}`);
    }

    if (!collectionId) {
      throw new Error('collectionId is null');
    }

    const {
      name,
      tempId,
      mode,
      blob,
      imageUrl,
      uuid,
      contentUrl,
      dataUrl,
      workerId,
      timecode = 0,
      submitted = new Date().getTime(),
    } = data || {};

    if (!blob && !imageUrl) {
      throw new Error('either param.blob or param.imageUrl must be specified');
    }

    if (!name && !tempId) {
      throw new Error('param.name or param.tempId must be specified');
    }

    this.$collectionId = collectionId;
    this.$name = name && X.normalizeFileName(name);
    this.$tempId = tempId;
    this.$uuid = uuid;
    this.$contentUrl = contentUrl;
    this.$timecode = Number.parseInt(timecode, 10);
    this.$submitted = submitted;
    this.$mode = mode || ((tempId) ? TAG_MODE_GROUNDTRUTH : TAG_MODE_MANUAL);
    this.$original = blob && Buffer.from(blob.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    this.$dataUrl = dataUrl;
    this.$imageUrl = imageUrl;
    this.$workerId = workerId;

    this.$instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
  }

  get collectionId() {
    return this.$collectionId;
  }

  get original() {
    return this.$original;
  }

  get name() {
    return this.$name;
  }

  get tempId() {
    return this.$tempId;
  }

  get uuid() {
    return this.$uuid;
  }

  get contentUrl() {
    return this.$contentUrl;
  }

  get timecode() {
    return this.$timecode;
  }

  get submitted() {
    return this.$submitted;
  }

  get mode() {
    return this.$mode;
  }

  set mode(val) {
    this.$mode = val;
  }

  get dataUrl() {
    return this.$dataUrl;
  }

  set dataUrl(val) {
    this.$dataUrl = val;
  }

  get imageUrl() {
    return this.$imageUrl;
  }

  set imageUrl(val) {
    this.$imageUrl = val;
  }

  get workerId() {
    return this.$workerId;
  }

  get instance() {
    return this.$instance;
  }

  /**
   * @function createCollection
   * @description create rekognition collection
   */
  async createCollection() {
    try {
      await this.instance.createCollection({
        CollectionId: this.collectionId,
      }).promise();
    } catch (e) {
      if (e.code !== 'ResourceAlreadyExistsException') {
        throw e;
      }
    }
  }

  /**
   * @function getImageParam
   * @description this could either be a blob or a S3 location of the image
   */
  getImageParam() {
    if (this.original) {
      return {
        Bytes: this.original,
      };
    }

    const {
      hostname,
      pathname,
    } = URL.parse(this.imageUrl);

    const {
      dir,
      base,
    } = PATH.parse(decodeURI(pathname.slice(1)));

    return {
      S3Object: {
        Bucket: hostname,
        Name: PATH.join(dir, base),
      },
    };
  }

  /**
   * @function indexNow
   * @description index face to Rekognition collection and store it to DynamoDB
   */
  async indexNow() {
    if (!this.dataUrl) {
      throw new Error('invalid dataUrl');
    }

    const params = {
      CollectionId: this.collectionId,
      Image: this.getImageParam(),
      ExternalImageId: X.normalizeFileName(this.name),
      DetectionAttributes: [
        'DEFAULT',
      ],
      MaxFaces: 1,
    };

    let response;
    let tries = 0;

    do {
      try {
        response = await this.instance.indexFaces(params).promise();
      } catch (e) {
        if (e.code === 'ResourceNotFoundException') {
          await this.createCollection();
        } else if (e.code === 'ProvisionedThroughputExceededException' || e.code === 'ThrottlingException') {
          await X.pause(500);
        } else {
          e.message = `${this.name}: ${e.message}`;
          throw e;
        }
      }
    } while (tries++ < MAX_RETRIES && (response || {}).FaceRecords === undefined);

    if (!(response || {}).FaceRecords) {
      throw new Error(`${this.name}: failed to index face`);
    }

    /* save it to dynamoDB */
    const promises = response.FaceRecords.map(x => ({
      name: x.Face.ExternalImageId,
      faceId: x.Face.FaceId,
      collectionId: this.collectionId,
      uuid: this.uuid,
      contentUrl: this.contentUrl,
      dataUrl: this.dataUrl,
      mode: this.mode,
      timecode: this.timecode,
      submitted: this.submitted,
      workerId: this.workerId,
    })).map(x => this.indexedDB(x));

    return Promise.all(promises);
  }

  /**
   * @function indexedDB
   * @description update indexedFaces DB record
   * @param {object} record
   */
  async indexedDB(record) {
    /* Name, FaceId, ContentUuid, Blob, Timecode, Submitted, Mode */
    const db = new DB({
      Table: Environment.DynamoDB.IndexedFaces.Table,
      PartitionKey: Environment.DynamoDB.IndexedFaces.PartitionKey,
      SortKey: Environment.DynamoDB.IndexedFaces.SortKey,
    });

    await db.update(record.name, record.faceId, record, false);

    return record;
  }

  /**
   * @function queueNow
   * @description queue face for Ground Truth
   * * upload image to S3 bucket
   * * create a temporary record in QueuedFacesDB
   */
  async queueNow() {
    if (!this.dataUrl) {
      throw new Error('invalid dataUrl');
    }

    /* upload the image to s3 */
    const {
      hostname: bucket,
      pathname,
    } = URL.parse(this.contentUrl);

    const {
      dir,
    } = PATH.parse(decodeURI(pathname));
    const key = PATH.join('ground-truth', dir, `${this.tempId}.png`);

    await X.upload({
      Bucket: bucket,
      Key: key,
      Body: this.original,
    });

    /* save it to dynamoDB */
    const promises = [{
      tempId: this.tempId,
      collectionId: this.collectionId,
      uuid: this.uuid,
      contentUrl: this.contentUrl,
      dataUrl: this.dataUrl,
      mode: this.mode,
      timecode: this.timecode,
      submitted: this.submitted,
      imageUrl: `s3://${bucket}/${key}`,
      ttl: X.timeToLiveInSecond(QUEUED_FACE_EXPIRE_IN_DAYS),
    }].map(x =>
      this.queuedDB(x));

    return Promise.all(promises);
  }

  /**
   * @function queuedDB
   * @description update record to QueuedFacesDB
   * @param {object} record
   */
  async queuedDB(record) {
    const db = new DB({
      Table: Environment.DynamoDB.QueuedFaces.Table,
      PartitionKey: Environment.DynamoDB.QueuedFaces.PartitionKey,
    });

    await db.update(record.tempId, undefined, record, false);
    return record;
  }

  /**
   * @function listFaces
   * @description list faces from Rekognition collection
   * @param {number} maxResults
   */
  async listFaces(maxResults = 20) {
    return this.instance.listFaces({
      CollectionId: this.collectionId,
      MaxResults: maxResults,
    }).promise();
  }

  /**
   * @static
   * @function purgeCollection
   * @description delete Rekognition collection
   * @param {string} collectionId
   */
  static async purgeCollection(collectionId) {
    if (!collectionId) {
      throw new Error('collectionId is null');
    }

    const instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });

    try {
      const response = await instance.deleteCollection({
        CollectionId: collectionId,
      }).promise();

      const db = new DB({
        Table: Environment.DynamoDB.IndexedFaces.Table,
        PartitionKey: Environment.DynamoDB.IndexedFaces.PartitionKey,
        SortKey: Environment.DynamoDB.IndexedFaces.SortKey,
      });

      const records = await db.scan();

      await Promise.all(records.map(x =>
        db.purge(x.name, x.faceId)));

      return response;
    } catch (e) {
      if (e.code === 'ResourceNotFoundException') {
        return {
          statusCode: 304,
          statusMessage: 'CollectionNotFound',
        };
      }
      throw e;
    }
  }

  /**
   * @static
   * @function scanIndexedFaces
   * @description scan indexed faces
   * * get records from IndexedFacesDB
   * @param {string} [uuid]
   */
  static async scanIndexedFaces(uuid) {
    const db = new DB({
      Table: Environment.DynamoDB.IndexedFaces.Table,
      PartitionKey: Environment.DynamoDB.IndexedFaces.PartitionKey,
      SortKey: Environment.DynamoDB.IndexedFaces.SortKey,
    });

    const params = (uuid)
      ? {
        uuid: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [
            uuid,
          ],
        },
      }
      : undefined;

    return db.scan(params);
  }

  /**
   * @static
   * @function scanQueuedFaces
   * @description scan queued faces
   * * get records from QueuedFacesDB
   * @param {string} [uuid]
   */
  static async scanQueuedFaces(uuid) {
    const db = new DB({
      Table: Environment.DynamoDB.QueuedFaces.Table,
      PartitionKey: Environment.DynamoDB.QueuedFaces.PartitionKey,
    });

    const params = (uuid)
      ? {
        uuid: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [
            uuid,
          ],
        },
      }
      : undefined;

    return db.scan(params);
  }

  /**
   * @static
   * @function purgeIndexedFace
   * @description purge face from
   * * IndexedFacesDB
   * * Rekognition collection
   * @param {string} collectionId
   * @param {string} name
   * @param {string} faceId
   */
  static async purgeIndexedFace(collectionId, name, faceId) {
    if (!collectionId || !name || !faceId) {
      throw new Error('missing collectionId, name, or faceId');
    }

    const promises = [];

    const db = new DB({
      Table: Environment.DynamoDB.IndexedFaces.Table,
      PartitionKey: Environment.DynamoDB.IndexedFaces.PartitionKey,
      SortKey: Environment.DynamoDB.IndexedFaces.SortKey,
    });

    promises.push(db.purge(name, faceId));

    const instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });

    promises.push(instance.deleteFaces({
      CollectionId: collectionId,
      FaceIds: [
        faceId,
      ],
    }).promise());

    return Promise.all(promises);
  }

  /**
   * @static
   * @function purgeQueuedFace
   * @description purge face from QueuedFacesDB
   * @param {string} tempId
   */
  static async purgeQueuedFace(tempId) {
    if (!tempId) {
      throw new Error('missing tempId');
    }

    const db = new DB({
      Table: Environment.DynamoDB.QueuedFaces.Table,
      PartitionKey: Environment.DynamoDB.QueuedFaces.PartitionKey,
    });

    return db.purge(tempId);
  }

  /**
   * @static
   * @async
   * @function getFaces
   * @description get faces from face collection
   * @param {string} collectionId
   * @param {Object} params
   * @param {string} [params.token]
   * @param {number} [params.pageSize]
   */
  static async getFaces(collectionId, params) {
    if (!collectionId) {
      throw new Error('missing collectionId');
    }

    const instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });

    return instance.listFaces({
      CollectionId: this.collectionId,
      MaxResults: Number.parseInt(params.pageSize || 20, 10),
      NextToken: params.token,
    }).promise();
  }
}

module.exports = {
  FaceCollection,
};
