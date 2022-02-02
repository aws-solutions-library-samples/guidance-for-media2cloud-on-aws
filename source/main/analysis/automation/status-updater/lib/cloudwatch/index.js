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
const TranscribeStatusChangeEvent = require('./transcribeStatusChangeEvent');
const BacklogStatusChangeEvent = require('./backlog/backlogStatusChangeEvent');
const RekognitionStatusChangeEvent = require('./backlog/rekognitionStatusChangeEvent');
const ComprehendStatusChangeEvent = require('./backlog/comprehendStatusChangeEvent');
const CustomLabelsStatusChangeEvent = require('./backlog/customLabelsStatusChangeEvent');

const CATEGORY_REKOGNITION = 'rekognition:';
const CATEGORY_COMPREHEND = 'comprehend:';
const CATEGORY_CUSTOM = 'custom:';

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
    if (this.source === TranscribeStatusChangeEvent.SourceType) {
      instance = new TranscribeStatusChangeEvent(this);
    } else if (this.source === BacklogStatusChangeEvent.SourceType) {
      if (this.detail.serviceApi.indexOf(CATEGORY_REKOGNITION) === 0) {
        instance = new RekognitionStatusChangeEvent(this);
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
    }).promise();
  }

  async sendTaskFailure(error) {
    return (new AWS.StepFunctions({
      apiVersion: '2016-11-23',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    })).sendTaskFailure({
      taskToken: this.token,
      error: error.name,
      cause: error.message,
    }).promise();
  }
}

module.exports = CloudWatchStatus;
