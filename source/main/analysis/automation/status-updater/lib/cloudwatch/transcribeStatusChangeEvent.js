// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  Environment,
  StateData,
  JobStatusError,
  Retry,
  ServiceToken,
} = require('core-lib');

class TranscribeStatusChangeEvent {
  constructor(parent) {
    if (!(parent.detail || {}).TranscriptionJobName
    || !(parent.detail || {}).TranscriptionJobStatus) {
      throw new Error('missing event.detail.TranscriptionJobName or TranscriptionJobStatus. exiting...');
    }
    this.$parent = parent;
    this.$service = undefined;
    this.$api = undefined;
  }

  static get SourceType() {
    return 'aws.transcribe';
  }

  static get Mapping() {
    return {
      COMPLETED: StateData.Statuses.Completed,
      FAILED: StateData.Statuses.Error,
    };
  }

  static get Event() {
    return {
      Completed: 'COMPLETED',
      Failed: 'FAILED',
    };
  }

  /**
   * @static
   * @function ValidateJobName
   * @description Job name must be in this format, <uuid>_<uuid>_<16-hex>
   * @param {*} name
   */
  static ValidateJobName(name) {
    return /^([a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}_){2}[a-fA-F0-9]{16}$/.test(name);
  }

  get parent() {
    return this.$parent;
  }

  get api() {
    return this.$api;
  }

  set api(val) {
    this.$api = val;
  }

  get service() {
    return this.$service;
  }

  set service(val) {
    this.$service = val;
  }

  get event() {
    return this.parent.event;
  }

  get context() {
    return this.parent.context;
  }

  get detail() {
    return this.parent.detail;
  }

  get token() {
    return this.parent.token;
  }

  set token(val) {
    this.parent.token = val;
  }

  get stateData() {
    return this.parent.stateData;
  }

  set stateData(val) {
    this.parent.stateData = val;
  }

  get status() {
    return this.event.detail.TranscriptionJobStatus;
  }

  get jobName() {
    return this.event.detail.TranscriptionJobName;
  }

  get timestamp() {
    return this.parent.timestamp;
  }

  async process() {
    /* make sure the event is meant for M2C */
    if (!TranscribeStatusChangeEvent.ValidateJobName(this.jobName)) {
      return undefined;
    }

    const response = await ServiceToken.getData(this.jobName).catch(() => undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new JobStatusError(`fail to get token, ${this.jobName}`);
    }

    this.token = response.token;
    this.service = response.service;
    this.api = response.api;

    this.stateData = new StateData(
      Environment.StateMachines.AudioAnalysis,
      response.data,
      this.context
    );

    switch (this.status) {
      case TranscribeStatusChangeEvent.Event.Completed:
        await this.onCompleted();
        break;
      case TranscribeStatusChangeEvent.Event.Failed:
      default:
        await this.onError();
        break;
    }
    await ServiceToken.unregister(this.jobName).catch(() => undefined);
    return this.stateData.toJSON();
  }

  async onCompleted() {
    const instance = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    const fn = instance.getTranscriptionJob.bind(instance);
    const response = await Retry.run(fn, {
      TranscriptionJobName: this.jobName,
    }).catch((e) => {
      throw new JobStatusError(`(${this.jobName}) ${e.message}`);
    });

    this.stateData.setData(this.service, {
      ...this.stateData.data[this.service],
      startTime: new Date(response.TranscriptionJob.CreationTime).getTime(),
      endTime: new Date(response.TranscriptionJob.CompletionTime).getTime(),
    });

    this.stateData.setCompleted();
    return this.parent.sendTaskSuccess();
  }

  async onError() {
    const instance = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    const fn = instance.getTranscriptionJob.bind(instance);
    const response = await Retry.run(fn, {
      TranscriptionJobName: this.jobName,
    }).catch(() => undefined);

    /* special handling: trascribe could fail if the audio doesn't contain speech */
    if (((response || {}).TranscriptionJob || {}).IdentifyLanguage) {
      this.stateData.setData(this.service, {
        ...this.stateData.data[this.service],
        endTime: this.timestamp,
        status: StateData.Statuses.NoData,
      });
      this.stateData.setNoData();
      return this.parent.sendTaskSuccess();
    }

    const error = (((response || {}).TranscriptionJob || {}).FailureReason)
      ? new JobStatusError(`${response.TranscriptionJob.FailureReason}`)
      : new JobStatusError(`${this.jobName} ${this.status}`);

    this.stateData.setData(this.service, {
      ...this.stateData.data[this.service],
      endTime: this.timestamp,
      status: TranscribeStatusChangeEvent.Mapping[this.status] || StateData.Statuses.Error,
    });

    this.stateData.setFailed(error);
    return this.parent.sendTaskFailure(error);
  }
}

module.exports = TranscribeStatusChangeEvent;
