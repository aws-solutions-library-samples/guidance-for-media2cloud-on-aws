// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  ServiceToken,
  JobStatusError,
} = require('core-lib');

const STATUS_SUCCEEDED = 'SUCCEEDED';
const STATUS_FAILED = 'FAILED';

class BacklogStatusChangeEvent {
  constructor(parent) {
    this.$parent = parent;
  }

  static get SourceType() {
    return 'custom.servicebacklog';
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

  get timestamp() {
    return new Date(this.event.time).getTime();
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

  get backlogId() {
    return this.detail.id;
  }

  get jobId() {
    return this.detail.jobId;
  }

  get errorMessage() {
    return this.detail.errorMessage;
  }

  async process() {
    if (this.status !== STATUS_SUCCEEDED && this.status !== STATUS_FAILED) {
      console.error(`BacklogStatusChangeEvent.process: ${this.status} status not handled`);
      return undefined;
    }

    /* #1: get state data from service token table */
    const response = await ServiceToken.getData(this.backlogId)
      .catch(() =>
        undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new JobStatusError(`fail to get token, ${this.backlogId}`);
    }

    /* #2: add JobId to the state data output */
    const category = response.service;
    const subCategory = response.api;
    response.data.data[category][subCategory].jobId = this.jobId;
    response.data.data[category][subCategory].endTime = this.timestamp;
    this.stateData = new StateData(
      Environment.StateMachines.VideoAnalysis,
      response.data,
      this.context
    );
    this.token = response.token;

    /* #3: send task result to state machine execution */
    if (this.status === STATUS_SUCCEEDED) {
      this.stateData.setCompleted();
      await this.parent.sendTaskSuccess();
    } else if (this.status === STATUS_FAILED) {
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

module.exports = BacklogStatusChangeEvent;
