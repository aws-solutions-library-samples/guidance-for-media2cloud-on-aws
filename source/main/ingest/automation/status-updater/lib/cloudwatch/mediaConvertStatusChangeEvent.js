// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  Environment,
  StateData,
  JobStatusError,
  ServiceToken,
} = require('core-lib');

class MediaConvertStatusChangeEvent {
  constructor(parent) {
    this.$parent = parent;
    this.$service = undefined;
    this.$api = undefined;
  }

  static get SourceType() {
    return 'aws.mediaconvert';
  }

  static get Mapping() {
    return {
      SUBMITTED: StateData.Statuses.Started,
      PROGRESSING: StateData.Statuses.InProgress,
      STATUS_UPDATE: StateData.Statuses.InProgress,
      COMPLETE: StateData.Statuses.Completed,
      CANCELED: StateData.Statuses.Error,
      ERROR: StateData.Statuses.Error,
    };
  }

  static get Event() {
    return {
      Completed: 'COMPLETE',
      Canceled: 'CANCELED',
      Error: 'ERROR',
      InProgress: 'STATUS_UPDATE',
    };
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
    return this.detail.status;
  }

  get jobId() {
    return this.detail.jobId;
  }

  get timestamp() {
    return this.detail.timestamp;
  }

  get outputGroupDetails() {
    return this.detail.outputGroupDetails;
  }

  get jobPercentComplete() {
    return (this.detail.jobProgress || {}).jobPercentComplete || 0;
  }

  get errorMessage() {
    return this.detail.errorMessage;
  }

  get errorCode() {
    return this.detail.errorCode;
  }

  async process() {
    const response = await ServiceToken.getData(this.jobId).catch(() => undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new JobStatusError(`fail to get token, ${this.jobId}`);
    }

    this.token = response.token;
    this.service = response.service;
    this.api = response.api;

    this.stateData = new StateData(
      Environment.StateMachines.Ingest,
      response.data,
      this.context
    );

    let completed = true;
    switch (this.status) {
      case MediaConvertStatusChangeEvent.Event.Completed:
        await this.onCompleted();
        break;
      case MediaConvertStatusChangeEvent.Event.InProgress:
        await this.onProgress();
        completed = false;
        break;
      case MediaConvertStatusChangeEvent.Event.Canceled:
      case MediaConvertStatusChangeEvent.Event.Error:
      default:
        await this.onError();
        break;
    }
    if (completed) {
      await ServiceToken.unregister(this.jobId).catch(() => undefined);
    }
    return this.stateData.toJSON();
  }

  async onCompleted() {
    this.stateData.setData(this.service, {
      ...this.stateData.data[this.service],
      jobId: this.jobId,
      endTime: this.timestamp,
    });

    this.stateData.setCompleted();
    return this.parent.sendTaskSuccess();
  }

  async onError() {
    const error = (this.status === MediaConvertStatusChangeEvent.Event.Canceled)
      ? new JobStatusError('user canceled job')
      : (this.status === MediaConvertStatusChangeEvent.Event.Error)
        ? new JobStatusError(`${this.errorMessage} (${this.errorCode})`)
        : new JobStatusError();

    this.stateData.setData(this.service, {
      ...this.stateData.data[this.service],
      jobId: this.jobId,
      timestamp: this.timestamp,
      status: MediaConvertStatusChangeEvent.Mapping[this.status] || StateData.Statuses.Error,
    });

    this.stateData.setFailed(error);
    return this.parent.sendTaskFailure(error);
  }

  async onProgress() {
    this.stateData.setProgress(this.jobPercentComplete);
    return undefined;
  }
}

module.exports = MediaConvertStatusChangeEvent;
