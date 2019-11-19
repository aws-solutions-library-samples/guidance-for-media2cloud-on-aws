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
const AWS = require('aws-sdk');
const PATH = require('path');
const CRYPTO = require('crypto');

const {
  Environment,
  StateData,
  CommonUtils,
  AnalysisError,
  BaseAnalysis,
  Retry,
} = require('m2c-core-lib');

/**
 * @class Textract
 */
class BaseTextract extends BaseAnalysis {
  constructor(keyword, stateData) {
    super(keyword, stateData);

    this.$tag = `${this.$stateData.uuid}_${CRYPTO.randomBytes(8).toString('hex')}`;
    this.$collection = {};

    this.$instance = new AWS.Textract({
      apiVersion: '2018-06-27',
    });
  }

  static get ServiceType() {
    return 'textract';
  }

  static get TextractStatusMapping() {
    return {
      IN_PROGRESS: StateData.Statuses.InProgress,
      FAILED: StateData.Statuses.Error,
      SUCCEEDED: StateData.Statuses.Completed,
      PARTIAL_SUCCESS: StateData.Statuses.Completed,
    };
  }

  get [Symbol.toStringTag]() {
    return 'BaseTextract';
  }

  get propList() {
    return 'Blocks';
  }

  get propName() {
    throw new AnalysisError('propName not impl');
  }

  get propKey() {
    return 'Page';
  }

  get tag() {
    return this.$tag;
  }

  get collection() {
    return this.$collection;
  }

  get instance() {
    return this.$instance;
  }

  storeUniquePropKeys(list, filename) {
    let keys = list.map(x => x[this.propKey].toString()).filter(x => x);
    keys = [...new Set(keys)]; // make sure keys are unique
    keys.forEach((key) => {
      this.collection[key] = this.collection[key] || [];
      this.collection[key].push(filename);
    });
  }

  async processEach(idx, fn, params) {
    const response = await Retry.run(fn, params).catch((e) => {
      throw new AnalysisError(`(${params.JobId}) ${e.message}`);
    });

    const list = (response || {})[this.propList] || [];

    const prefix = this.makeOutputPrefix();
    const filename = `${String(idx).padStart(8, '0')}.json`;

    const promise = CommonUtils.upload({
      Bucket: Environment.Proxy.Bucket,
      Key: PATH.join(prefix, filename),
      ContentType: 'application/json',
      ContentDisposition: `attachment; filename="${filename}"`,
      ServerSideEncryption: 'AES256',
      Body: JSON.stringify(list, null, 2),
    });

    this.storeUniquePropKeys(list, filename);

    await promise;

    console.log(`idx: ${idx}, token: ${response.NextToken}`);
    return response.NextToken;
  }

  async startJob(fn, options) {
    const params = CommonUtils.neat(Object.assign(this.makeParams(), options));

    console.log(`startJob.textract = ${JSON.stringify(params, null, 2)}`);

    const response = await fn(params).promise();

    if (!(response || {}).JobId) {
      const document = (this.stateData.input || {}).document || {};
      throw new AnalysisError(`(${document.key}) startJob.${this.keyword} job failed.`);
    }

    this.stateData.setData(BaseTextract.ServiceType, {
      [this.keyword]: {
        id: response.JobId,
        startTime: (new Date()).getTime(),
      },
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  async checkJobStatus(fn) {
    const data = ((this.stateData.input || {}).textract || {})[this.keyword] || {};

    if (!data.id) {
      throw new AnalysisError(`missing input.textract.${this.keyword}.id`);
    }

    const response = await Retry.run(fn, {
      JobId: data.id,
    }).catch((e) => {
      throw new AnalysisError(`(${data.id}) ${e.message}`);
    });

    if (!response) {
      throw new AnalysisError(`(${data.id}) fail to get rekognition ${this.keyword} status`);
    }

    const status = BaseTextract.TextractStatusMapping[response.JobStatus];
    console.log(`${response.JobStatus} -> ${status}`);

    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(response.StatusMessage || `(${data.id}) ${this.keyword} job failed`);
    }

    if (status === StateData.Statuses.Completed) {
      this.stateData.setData(BaseTextract.ServiceType, {
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


  async collectJobResults(...args) {
    const fn = args.shift();

    if (typeof fn !== 'function') {
      throw new AnalysisError('collectJobResults expects function as input');
    }

    const data = ((this.stateData.input || {}).textract || {})[this.keyword] || {};

    if (!data.id) {
      throw new AnalysisError(`missing input.textract.${this.keyword}.id`);
    }

    let next;
    let idx = 0;
    do {
      const params = CommonUtils.neat(Object.assign({
        JobId: data.id,
        NextToken: next,
      }));
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

    this.stateData.setData(BaseTextract.ServiceType, {
      [this.keyword]: Object.assign(data, {
        output,
      }),
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  makeParams() {
    const document = (this.stateData.input || {}).document || {};

    if (!document.key) {
      throw new AnalysisError('input.document.key is missing');
    }

    return {
      JobTag: this.tag,
      ClientRequestToken: this.tag,
      DocumentLocation: {
        S3Object: {
          Bucket: Environment.Proxy.Bucket,
          Name: document.key,
        },
      },
    };
  }

  makeOutputPrefix() {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.document.baseDir,
      'raw',
      timestamp,
      BaseTextract.ServiceType,
      this.keyword
    );
  }
}

module.exports = {
  BaseTextract,
};
