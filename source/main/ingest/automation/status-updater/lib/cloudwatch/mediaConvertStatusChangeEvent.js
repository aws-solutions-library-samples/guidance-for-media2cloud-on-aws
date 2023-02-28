// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  JobStatusError,
  ServiceToken,
} = require('core-lib');

const STATUS_SUCCEEDED = 'COMPLETE';
const STATUS_FAILED = [
  'CANCELED',
  'ERROR',
];
const ALLOWED_STATUSES = [
  ...STATUS_FAILED,
  STATUS_SUCCEEDED,
];

class MediaConvertStatusChangeEvent {
  constructor(parent) {
    this.$parent = parent;
  }

  get parent() {
    return this.$parent;
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

  get backlogId() {
    return this.detail.id;
  }

  get jobId() {
    return this.detail.jobId;
  }

  get status() {
    return this.detail.status;
  }

  get timestamp() {
    return new Date(this.event.time).getTime();
  }

  async process() {
    if (ALLOWED_STATUSES.indexOf(this.status) < 0) {
      console.error(`ERR: MediaConvertStatusChangeEvent.process: ${this.status} status not handled`);
      return undefined;
    }

    const response = await ServiceToken.getData(this.backlogId)
      .catch(() =>
        undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new JobStatusError(`fail to get token, ${this.jobId}`);
    }

    const stateMachine = (response.api === 'audio')
      ? Environment.StateMachines.AudioIngest
      : Environment.StateMachines.VideoIngest;
    response.data.data[response.service] = {
      ...response.data.data[response.service],
      jobId: this.jobId,
      endTime: this.timestamp,
    };
    this.stateData = new StateData(
      stateMachine,
      response.data,
      this.context
    );
    this.token = response.token;

    if (this.status === STATUS_SUCCEEDED) {
      this.stateData.setCompleted();
      await this.parent.sendTaskSuccess();
    } else {
      const error = (this.errorMessage)
        ? new JobStatusError(this.errorMessage)
        : new JobStatusError(`${this.jobId} ${this.status}`);
      this.stateData.setFailed(error);
      await this.parent.sendTaskFailure(error);
    }
    /* #4: remove record from service token table */
    await ServiceToken.unregister(this.backlogId)
      .catch(() =>
        undefined);
    return this.stateData.toJSON();
  }
}

module.exports = MediaConvertStatusChangeEvent;
