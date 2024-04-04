// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SFNClient,
  SendTaskSuccessCommand,
  SendTaskFailureCommand,
  TaskTimedOut,
  TaskDoesNotExist,
} = require('@aws-sdk/client-sfn');
const {
  JobStatusError,
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
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

const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

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
    const output = JSON.stringify(this.stateData.toJSON());

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new SendTaskSuccessCommand({
      output,
      taskToken: this.token,
    });

    return stepfunctionClient.send(command)
      .catch((e) => {
        if (e instanceof TaskTimedOut
        || e instanceof TaskDoesNotExist) {
          return undefined;
        }
        console.error(
          'ERR:',
          'CloudWatchStatus.sendTaskSuccess:',
          `${command.constructor.name}:`,
          e.$metadata.httpStatusCode,
          e.name,
          e.message,
          output
        );
        throw e;
      });
  }

  async sendTaskFailure(error) {
    const message = {
      error: error.name || error.code,
      cause: error.message,
    };

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new SendTaskFailureCommand({
      ...message,
      taskToken: this.token,
    });

    return stepfunctionClient.send(command)
      .catch((e) => {
        if (e instanceof TaskTimedOut
        || e instanceof TaskDoesNotExist) {
          return undefined;
        }
        console.error(
          'ERR:',
          'CloudWatchStatus.sendTaskFailure:',
          `${command.constructor.name}:`,
          e.$metadata.httpStatusCode,
          e.name,
          e.message,
          JSON.stringify(message)
        );
        throw e;
      });
  }
}

module.exports = CloudWatchStatus;
