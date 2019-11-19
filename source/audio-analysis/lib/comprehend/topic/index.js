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
const URL = require('url');
const PATH = require('path');

const {
  Environment,
  CommonUtils,
  StateData,
  AnalysisError,
  Retry,
} = require('m2c-core-lib');

const {
  TarStream,
} = require('../tarStream');

const {
  BaseComprehend,
} = require('../base');

/**
 * @class Topic
 */
class Topic extends BaseComprehend {
  constructor(stateData) {
    super('topic', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Topic';
  }

  get propName() {
    return 'TopicsDetectionJobProperties';
  }

  /**
   * @override
   * @function checkCriteria
   * @description override since topic requires minimum of 500 bytes data
   */
  async checkCriteria() {
    const response = await CommonUtils.headObject(
      Environment.Proxy.Bucket,
      this.stateData.input.transcribe.output
    );

    return (response.ContentLength > 500);
  }

  /**
   * @override
   * @function setJobSucceeded
   * @description override to set the correct response
   */
  setJobSucceeded(prop) {
    const data =
      ((this.stateData.input || {})[BaseComprehend.ServiceType] || {}).topic || {};

    const output = URL.parse(prop.OutputDataConfig.S3Uri).pathname.slice(1);

    this.stateData.setData(BaseComprehend.ServiceType, {
      [this.keyword]: Object.assign(data, {
        startTime: new Date(prop.SubmitTime).getTime(),
        endTime: new Date(prop.EndTime).getTime(),
        output,
      }),
    });

    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  /**
   * @override
   * @function startJob
   * @description override to do asynchronized operation
   */
  async startJob() {
    const passed = await this.checkCriteria();
    if (!passed) {
      return this.dataLessThenThreshold();
    }

    const prefix = this.makeOutputPrefix();
    const params = {
      DataAccessRoleArn: process.env.ENV_COMPREHEND_ROLE,
      InputDataConfig: {
        S3Uri: `s3://${Environment.Proxy.Bucket}/${this.stateData.input.transcribe.output}`,
        InputFormat: 'ONE_DOC_PER_FILE',
      },
      OutputDataConfig: {
        S3Uri: `s3://${Environment.Proxy.Bucket}/${prefix}`,
      },
    };

    console.log(`startJob.topic = ${JSON.stringify(params, null, 2)}`);

    const response = await this.instance.startTopicsDetectionJob(params).promise();

    const status = BaseComprehend.ComprehendStatusMapping[response.JobStatus];
    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(response.Message || `(${response.JobId}) topic job failed`);
    }

    this.stateData.setData(BaseComprehend.ServiceType, {
      topic: {
        id: response.JobId,
      },
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @override
   * @function checkJobStatus
   * @description override to do asynchronized operation
   */
  async checkJobStatus() {
    const data =
      ((this.stateData.input || {})[BaseComprehend.ServiceType] || {}).topic || {};

    if (!data.id) {
      throw new AnalysisError(`missing input.${BaseComprehend.ServiceType}.topic.id`);
    }

    const fn = this.instance.describeTopicsDetectionJob.bind(this.instance);
    const response = await Retry.run(fn, {
      JobId: data.id,
    }).catch((e) => {
      throw new AnalysisError(`(${data.id}) ${e.message}`);
    });

    const prop = (response || {}).TopicsDetectionJobProperties;
    if (!prop) {
      throw new AnalysisError(`(${data.id}) fail to get ${BaseComprehend.ServiceType}.topic status`);
    }

    const status = BaseComprehend.ComprehendStatusMapping[prop.JobStatus];
    console.log(`${prop.JobStatus} -> ${status}`);

    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(prop.Message || `(${data.id}) topic job failed`);
    }

    if (status === StateData.Statuses.Completed) {
      return this.setJobSucceeded(prop);
    }

    return this.setJobInProgress();
  }

  /**
   * @override
   * @function collectJobResults
   * @description override to do asynchronized operation
   */
  async collectJobResults(...args) {
    const data =
      ((this.stateData.input || {})[BaseComprehend.ServiceType] || {}).topic || {};

    if (!data.output) {
      throw new AnalysisError(`missing input.${BaseComprehend.ServiceType}.${this.keyword}.output`);
    }

    const files = [
      'topic-terms.csv',
      'doc-topics.csv',
    ];

    const escaped = decodeURIComponent(data.output);
    const responses = await Promise.all(files.map(file =>
      (new TarStream(Environment.Proxy.Bucket, escaped)).extract(file)));

    const promises = [];
    const prefix = this.makeOutputPrefix();

    for (let idx = 0; idx < files.length; idx++) {
      promises.push(CommonUtils.upload({
        Bucket: Environment.Proxy.Bucket,
        Key: PATH.join(prefix, files[idx]),
        ContentType: 'text/csv',
        ContentDisposition: `attachment; filename="${files[idx]}"`,
        ServerSideEncryption: 'AES256',
        Body: (responses[idx]).toString(),
      }));
    }
    await Promise.all(promises);

    const combined = this.combineResults(responses[1], responses[0]);

    const output = await this.uploadMetadataResults(combined);

    return this.setTrackSucceeded(output);
  }

  /**
   * @override
   * @function createTrack
   * @description NOT IMPL
   */
  async createTrack(...args) {
    throw new AnalysisError('Topic.createTrack not impl');
  }

  /**
   * @function combineResults
   * @description topic specific function, combine topics and terms results
   * @param {Buffer} bufTopics
   * @param {Buffer} bufTerms
   */
  combineResults(bufTopics, bufTerms) {
    const topics = this.parseTopics(bufTopics);
    const terms = this.parseTerms(bufTerms);

    Object.keys(topics).forEach((key) => {
      if (terms[key]) {
        terms[key].proportion = topics[key];
      }
    });
    return terms;
  }

  /**
   * @function parseTerms
   * @description topic specific function, parse terms results
   * @param {Buffer} buffer
   */
  parseTerms(buffer) {
    const data = buffer.toString().split('\n').filter(x => x);
    data.shift();

    const parsed = {};
    data.forEach((line) => {
      const [
        topic,
        term,
        weight,
      ] = line.split(',').filter(x => x);
      parsed[topic] = parsed[topic] || {};
      parsed[topic].terms = parsed[topic].terms || [];
      parsed[topic].terms.push({
        term,
        weight: Number.parseFloat(weight),
      });
    });
    return parsed;
  }

  /**
   * @function parseTopics
   * @description topic specific function, parse topics results
   * @param {Buffer} buffer
   */
  parseTopics(buffer) {
    const data = buffer.toString().split('\n').filter(x => x);
    data.shift();

    const parsed = {};
    data.forEach((line) => {
      const [
        docname,
        topic,
        proportion,
      ] = line.split(',').filter(x => x);
      parsed[topic] = Number.parseFloat(proportion);
    });
    return parsed;
  }
}

module.exports = {
  Topic,
};
