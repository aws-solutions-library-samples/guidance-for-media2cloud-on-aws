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
const BacklogStatusChangeEvent = require('./backlog/backlogStatusChangeEvent');
const RekognitionStatusChangeEvent = require('./backlog/rekognitionStatusChangeEvent');
const TextractStatusChangeEvent = require('./backlog/textractStatusChangeEvent');
const TranscribeStatusChangeEvent = require('./backlog/transcribeStatusChangeEvent');
const ComprehendStatusChangeEvent = require('./backlog/comprehendStatusChangeEvent');
const CustomLabelsStatusChangeEvent = require('./backlog/customLabelsStatusChangeEvent');

const CATEGORY_REKOGNITION = 'rekognition:';
const CATEGORY_TEXTRACT = 'textract:';
const CATEGORY_TRANSCRIBE = 'transcribe:';
const CATEGORY_COMPREHEND = 'comprehend:';
const CATEGORY_CUSTOM = 'custom:';

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
    if (this.source === BacklogStatusChangeEvent.SourceType) {
      if (this.detail.serviceApi.indexOf(CATEGORY_REKOGNITION) === 0) {
        instance = new RekognitionStatusChangeEvent(this);
      } else if (this.detail.serviceApi.indexOf(CATEGORY_TEXTRACT) === 0) {
        instance = new TextractStatusChangeEvent(this);
      } else if (this.detail.serviceApi.indexOf(CATEGORY_TRANSCRIBE) === 0) {
        instance = new TranscribeStatusChangeEvent(this);
      } else if (this.detail.serviceApi.indexOf(CATEGORY_COMPREHEND) === 0) {
        instance = new ComprehendStatusChangeEvent(this);
      } else if (this.detail.serviceApi.indexOf(CATEGORY_CUSTOM) === 0) {
        instance = new CustomLabelsStatusChangeEvent(this);
      }
    }
    if (!instance) {
      throw new JobStatusError(`${this.source} not supported`);
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
