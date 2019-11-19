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
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */

const AWS = require('aws-sdk');
const PATH = require('path');
const CRYPTO = require('crypto');

const {
  Environment,
  CommonUtils,
  StateData,
  Retry,
  AnalysisError,
  BaseAnalysis,
  DB,
  WebVttTrack,
} = require('m2c-core-lib');

const {
  TrackItem,
} = require('./trackItem');

const {
  TimelineItem,
} = require('./timelineItem');

/**
 * @class BaseRekognition
 */
class BaseRekognition extends BaseAnalysis {
  constructor(keyword, stateData) {
    super(keyword, stateData);

    this.$tag = `${this.$stateData.uuid}_${CRYPTO.randomBytes(8).toString('hex')}`;
    this.$minConfidence = 70;
    this.$collection = {};

    this.$instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
  }

  static get ServiceType() {
    return 'rekognition';
  }

  static get RekognitionStatusMapping() {
    return {
      IN_PROGRESS: StateData.Statuses.InProgress,
      SUCCEEDED: StateData.Statuses.Completed,
      FAILED: StateData.Statuses.Error,
    };
  }

  get [Symbol.toStringTag]() {
    return 'BaseRekognition';
  }

  get propList() {
    throw new AnalysisError('propList not impl');
  }

  get propName() {
    throw new AnalysisError('propName not impl');
  }

  get propKey() {
    throw new AnalysisError('propKey not impl');
  }

  get tag() {
    return this.$tag;
  }

  get minConfidence() {
    return this.$minConfidence;
  }

  get collection() {
    return this.$collection;
  }

  get instance() {
    return this.$instance;
  }

  async startJob(fn, options) {
    const params = CommonUtils.neat(Object.assign(this.makeParams(), options));

    console.log(`startJob.${this.keyword} = ${JSON.stringify(params, null, 2)}`);

    const response = await fn(params).promise();

    if (!(response || {}).JobId) {
      const video = (this.stateData.input || {}).video || {};
      throw new AnalysisError(`(${video.key}) startJob.${this.keyword} job failed.`);
    }

    this.stateData.setData(BaseRekognition.ServiceType, {
      [this.keyword]: {
        id: response.JobId,
        startTime: (new Date()).getTime(),
      },
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  async checkJobStatus(fn) {
    const data = ((this.stateData.input || {}).rekognition || {})[this.keyword] || {};

    if (!data.id) {
      throw new AnalysisError(`missing input.rekognition.${this.keyword}.id`);
    }

    const response = await Retry.run(fn, {
      JobId: data.id,
      MaxResults: 1,
    }).catch((e) => {
      throw new AnalysisError(`(${data.id}) ${e.message}`);
    });

    if (!response) {
      throw new AnalysisError(`(${data.id}) fail to get rekognition ${this.keyword} status`);
    }

    const status = BaseRekognition.RekognitionStatusMapping[response.JobStatus];
    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(response.StatusMessage || `(${data.id}) ${this.keyword} job failed`);
    }

    if (status === StateData.Statuses.Completed) {
      this.stateData.setData(BaseRekognition.ServiceType, {
        [this.keyword]: Object.assign(data, {
          endTime: new Date().getTime(),
        }),
      });
      this.stateData.setCompleted();
    } else {
      this.stateData.setProgress(this.stateData.progress + 1);
    }

    return this.stateData.toJSON();
  }

  storeUniqueMappings(response, filename) {
    throw new AnalysisError('storeUniqueMappings not impl.');
  }

  async downloadSelected(bucket, key, name) {
    throw new AnalysisError('downloadSelected not impl.');
  }

  async processEach(idx, fn, params) {
    let response = await Retry.run(fn, params).catch((e) => {
      throw new AnalysisError(`(${params.JobId}) ${e.message}`);
    });
    const token = response.NextToken;

    [
      'JobStatus',
      'StatusMessage',
      'VideoMetadata',
      'NextToken',
    ].forEach(x => delete response[x]);

    response = this.patchResults(response);

    const prefix = this.makeOutputPrefix();
    const filename = `${String(idx).padStart(8, '0')}.json`;

    const promise = CommonUtils.upload({
      Bucket: Environment.Proxy.Bucket,
      Key: PATH.join(prefix, filename),
      ContentType: 'application/json',
      ContentDisposition: `attachment; filename="${filename}"`,
      ServerSideEncryption: 'AES256',
      Body: JSON.stringify(response, null, 2),
    });

    this.storeUniqueMappings(response, filename);

    await promise;

    return token;
  }

  async collectJobResults(...args) {
    const fn = args.shift();
    const options = args.shift();

    if (typeof fn !== 'function') {
      throw new AnalysisError('collectJobResults expects function as input');
    }

    const data = ((this.stateData.input || {}).rekognition || {})[this.keyword] || {};

    if (!data.id) {
      throw new AnalysisError(`missing input.rekognition.${this.keyword}.id`);
    }

    let next;
    let idx = 0;
    do {
      const params = CommonUtils.neat(Object.assign({
        JobId: data.id,
        SortBy: 'TIMESTAMP',
        NextToken: next,
      }, options));
      next = await this.processEach(idx++, fn, params);
    } while (next);

    const prefix = this.makeOutputPrefix();
    const output = PATH.join(prefix, 'output.json');

    await CommonUtils.upload({
      Bucket: Environment.Proxy.Bucket,
      Key: output,
      ContentType: 'application/json',
      ContentDisposition: 'attachment; filename="output.json"',
      ServerSideEncryption: 'AES256',
      Body: JSON.stringify(this.collection, null, 2),
    });

    await this.updateMap(this.collection);

    this.stateData.setData(BaseRekognition.ServiceType, {
      [this.keyword]: Object.assign(data, {
        output,
      }),
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  makeParams() {
    const video = (this.stateData.input || {}).video || {};

    if (!video.key) {
      throw new AnalysisError('input.video.key is missing');
    }

    return {
      JobTag: this.tag,
      ClientRequestToken: this.tag,
      Video: {
        S3Object: {
          Bucket: Environment.Proxy.Bucket,
          Name: video.key,
        },
      },
    };
  }

  makeOutputPrefix() {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.video.baseDir,
      'raw',
      timestamp,
      BaseRekognition.ServiceType,
      this.keyword
    );
  }

  makeVttPrefix() {
    return PATH.join(
      this.stateData.input.video.baseDir,
      'vtt',
      this.keyword
    );
  }

  makeMetadataPrefix() {
    return PATH.join(
      this.stateData.input.video.baseDir,
      'metadata',
      this.keyword
    );
  }

  async downloadJson(bucket, key) {
    const items = await CommonUtils.download(bucket, key);
    return JSON.parse(items.toString());
  }

  patchResults(response) {
    return response;
  }

  async fetchMap() {
    const db = new DB({
      Table: Environment.DynamoDB.AnalysisQueue.Table,
      PartitionKey: Environment.DynamoDB.AnalysisQueue.PartitionKey,
      SortKey: Environment.DynamoDB.AnalysisQueue.SortKey,
    });

    const response = await db.fetch(this.stateData.uuid, this.keyword);
    return response.mapping;
  }

  async updateMap(mapping) {
    const db = new DB({
      Table: Environment.DynamoDB.AnalysisQueue.Table,
      PartitionKey: Environment.DynamoDB.AnalysisQueue.PartitionKey,
      SortKey: Environment.DynamoDB.AnalysisQueue.SortKey,
    });

    return db.update(this.stateData.uuid, this.keyword, {
      mapping,
      ttl: CommonUtils.timeToLiveInSecond(),
    }, false);
  }

  async purgeMap() {
    const db = new DB({
      Table: Environment.DynamoDB.AnalysisQueue.Table,
      PartitionKey: Environment.DynamoDB.AnalysisQueue.PartitionKey,
      SortKey: Environment.DynamoDB.AnalysisQueue.SortKey,
    });

    return db.purge(this.stateData.uuid, this.keyword);
  }

  async createTrack(...args) {
    const data =
      ((this.stateData.input || {})[BaseRekognition.ServiceType] || {})[this.keyword] || {};

    if (!data.output) {
      throw new AnalysisError(`missing input.${BaseRekognition.ServiceType}.${this.keyword}.output`);
    }

    const mappings = await this.fetchMap();
    const processed = [];

    /* recursively process track until lambda timeout */
    do {
      const name = Object.keys(mappings || {}).shift();
      if (!name) {
        break;
      }

      const {
        dir,
      } = PATH.parse(data.output);

      /*
      const responses = await Promise.all(mappings[name].map(x =>
        this.downloadJson(Environment.Proxy.Bucket, PATH.join(dir, x))));
      */
      const responses = await Promise.all(mappings[name].map(x =>
        this.downloadSelected(Environment.Proxy.Bucket, PATH.join(dir, x), name)));

      const collection = this.createCollection(name, responses);

      const vtt = this.createWebVtt(name, collection);
      const timelines = this.createTimelines(name, collection);

      const basename = name.toLowerCase().replace(/\s/g, '_');
      const vttKey = PATH.join(this.makeVttPrefix(), `${basename}.vtt`);
      const metadataKey = PATH.join(this.makeMetadataPrefix(), `${basename}.json`);

      await Promise.all([
        CommonUtils.upload({
          Bucket: Environment.Proxy.Bucket,
          Key: vttKey,
          ContentType: 'text/vtt',
          ContentDisposition: `attachment; filename="${basename}.vtt"`,
          ServerSideEncryption: 'AES256',
          Body: vtt,
        }),
        CommonUtils.upload({
          Bucket: Environment.Proxy.Bucket,
          Key: metadataKey,
          ContentType: 'application/json',
          ContentDisposition: `attachment; filename="${basename}.json"`,
          ServerSideEncryption: 'AES256',
          Body: JSON.stringify(timelines.map(x => x.toJSON()), null, 2),
        }),
      ]);

      delete mappings[name];
      processed.push(name);
    } while (!this.stateData.quitNow());

    if (!Object.keys(mappings || {}).length) {
      await this.purgeMap();
      this.stateData.setData(BaseRekognition.ServiceType, {
        [this.keyword]: Object.assign(data, {
          vtt: this.makeVttPrefix(),
          metadata: this.makeMetadataPrefix(),
        }),
      });
      this.stateData.setCompleted();
    } else {
      await this.updateMap(mappings);
      this.stateData.setProgress(this.stateData.progress + 1);
    }
    return this.stateData.toJSON();
  }

  createTrackItem(item) {
    return new TrackItem(this.propName, item);
  }

  createCollection(name, responses) {
    const collection = [];
    let cursor;

    while (responses.length) {
      const response = responses.shift();
      while (response.length) {
        const item = response.shift();

        if (item[this.propName][this.propKey].toString() !== name) {
          continue;
        }

        const current = this.createTrackItem(item);

        if (!cursor) {
          cursor = current;
          continue;
        }

        /* case 0: if no BoundingBox, combine the track. */
        if (!current.hasBoundingBox()) {
          if ((current.begin - cursor.end) < TrackItem.Constants.TimeDrift) {
            cursor.combineItem(current);
            continue;
          }
        }

        /* case 1: if timestamp is far apart (300ms), it is a break */
        if (cursor.timeDrift(current.begin)) {
          collection.push(cursor);
          cursor = current;
          continue;
        }

        /* case 2: check to see if position has drifted */
        if (cursor.positionDrift(current)) {
          collection.push(cursor);
          cursor = current;
          continue;
        }

        /* case 3: update end time */
        cursor.combineItem(current);
      }
    }

    /* case 4: process the last cursor */
    if (cursor && cursor.begin !== (collection[collection.length - 1] || {}).begin) {
      collection.push(cursor);
    }

    return collection;
  }

  createWebVtt(name, collection) {
    const track = new WebVttTrack();

    collection.forEach((item) => {
      track.addCue(item.begin, item.end, this.cueText(name, item), this.cuePosition(item));
    });

    return track.toString();
  }

  cuePosition(item) {
    const align = 'center';
    const x = (item.x === undefined) ? 0.5 : item.x;
    const y = (item.y === undefined) ? 0.5 : item.y;
    const line = Math.floor(y * 100);
    const position = Math.floor((x + ((item.w || 0) / 2)) * 100);
    return `align:${align} line:${line}% position:${position}% size:20%`;
  }

  cueText(name, item) {
    return `<c.${this.keyword}>${name}</c>\n<c.confidence>(${Number.parseFloat(item.confidence).toFixed(2)})</c>`;
  }

  createTimelines(name, collection) {
    const data = collection.slice();

    const timelines = [];
    let cursor;
    while (data.length) {
      const item = data.shift();

      if (!cursor) {
        cursor = new TimelineItem(item);
        continue;
      }

      /* combine track */
      if (cursor.timelineDrift(item.begin)) {
        cursor.combineItem(item);
        continue;
      }

      timelines.push(cursor);
      cursor = new TimelineItem(item);
    }

    /* special case: timestamp never discontinues */
    if (cursor && cursor.begin !== (timelines[timelines.length - 1] || {}).begin) {
      timelines.push(cursor);
    }

    return timelines;
  }
}

module.exports = {
  BaseRekognition,
};
