// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  JobStatusError,
  Environment,
} = require('core-lib');
const MediaConvertStatusChangeEvent = require('./mediaConvertStatusChangeEvent');

const BACKLOG_SOURCE_TYPE = 'custom.servicebacklog';
const SERVICE_MEDIACONVERT = 'mediaconvert:';

const EXCEPTION_TASK_TIMEOUT = 'TaskTimedOut';
const EXCEPTION_TASK_NOTEXIST = 'TaskDoesNotExist';
const IGNORED_EXECEPTION_LIST = [
  EXCEPTION_TASK_TIMEOUT,
  EXCEPTION_TASK_NOTEXIST,
];

class CloudWatchStatus {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
    this.$token = undefined;
    this.$stateData = undefined;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get token() {
    return this.$token;
  }

  set token(val) {
    this.$token = val;
  }

  get stateData() {
    return this.$stateData;
  }

  set stateData(val) {
    this.$stateData = val;
  }

  get source() {
    return this.event.source;
  }

  get detail() {
    return this.event.detail;
  }

  get account() {
    return this.event.account;
  }

  get timestamp() {
    return new Date(this.event.time).getTime();
  }

  async process() {
    let instance;
    if (this.source === BACKLOG_SOURCE_TYPE) {
      if (this.detail.serviceApi.indexOf(SERVICE_MEDIACONVERT) === 0) {
        instance = new MediaConvertStatusChangeEvent(this);
      }
    }
    if (!instance) {
      throw new JobStatusError(`${this.source}: ${this.detail.serviceApi}: not supported`);
    }
    return instance.process();
  }

  async sendTaskSuccess() {
    return (new AWS.StepFunctions({
      apiVersion: '2016-11-23',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    })).sendTaskSuccess({
      output: JSON.stringify(this.stateData.toJSON()),
      taskToken: this.token,
    }).promise()
      .catch((e) => {
        if (IGNORED_EXECEPTION_LIST.indexOf(e.code) >= 0) {
          return undefined;
        }
        console.log(`[ERR]: sendTaskSuccess: ${e.code}: ${e.message}`, JSON.stringify(this.stateData.toJSON()));
        throw e;
      });
  }

  async sendTaskFailure(error) {
    return (new AWS.StepFunctions({
      apiVersion: '2016-11-23',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    })).sendTaskFailure({
      taskToken: this.token,
      error: error.name,
      cause: error.message,
    }).promise()
      .catch((e) => {
        if (e.code === EXCEPTION_TASK_TIMEOUT) {
          return undefined;
        }
        console.log(`[ERR]: sendTaskFailure: ${e.code}: ${e.message}`, error.name, error.message);
        throw e;
      });
  }
}

module.exports = CloudWatchStatus;
