// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  ServiceToken,
  JobStatusError,
} = require('core-lib');
const BacklogStatusChangeEvent = require('./backlogStatusChangeEvent');

const STATUS_SUCCEEDED = 'SUCCEEDED';
const STATUS_FAILED = [
  'FAILED',
  'ABORTED',
  'TIMED_OUT',
];
const ALLOWED_STATUSES = [
  ...STATUS_FAILED,
  STATUS_SUCCEEDED,
];

class CustomLabelsStatusChangeEvent extends BacklogStatusChangeEvent {
  async process() {
    if (ALLOWED_STATUSES.indexOf(this.status) < 0) {
      console.error(`CustomLabelsStatusChangeEvent.process: ${this.status} status not handled`);
      return undefined;
    }
    /* #1: get state data from service token table */
    const response = await ServiceToken.getData(this.backlogId).catch(() => undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new JobStatusError(`fail to get token, ${this.backlogId}`);
    }
    /* #2: mesh stateMachineOutput and JobId to the analysis state data output */
    const subCategory = response.api;
    response.data.data[subCategory] = {
      ...response.data.data[subCategory],
      ...this.detail.stateMachineOutput,
      jobId: this.jobId,
      endTime: this.timestamp,
    };
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
    } else {
      const error = new JobStatusError(`${this.jobId} ${this.status}`);
      this.stateData.setFailed(error);
      await this.parent.sendTaskFailure(error);
    }
    /* #4: remove record from service token table */
    await ServiceToken.unregister(this.backlogId).catch(() => undefined);
    return this.stateData.toJSON();
  }
}

module.exports = CustomLabelsStatusChangeEvent;
