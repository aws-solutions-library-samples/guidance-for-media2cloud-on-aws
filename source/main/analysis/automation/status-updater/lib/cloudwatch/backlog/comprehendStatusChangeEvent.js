// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  ServiceToken,
  JobStatusError,
} = require('core-lib');
const BacklogStatusChangeEvent = require('./backlogStatusChangeEvent');

const STATUS_PROCESSING = 'PROCESSING';

class ComprehendStatusChangeEvent extends BacklogStatusChangeEvent {
  async process() {
    if (this.status !== STATUS_PROCESSING) {
      console.error(`ComprehendStatusChangeEvent.process: ${this.status} status not handled`);
      return undefined;
    }
    /* #1: get state data from service token table */
    const response = await ServiceToken.getData(this.backlogId).catch(() => undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new JobStatusError(`fail to get token, ${this.backlogId}`);
    }
    /* #2: add JobId to the state data output */
    const category = response.service;
    const subCategory = response.api;
    response.data.data[category][subCategory].jobId = this.jobId;
    this.stateData = new StateData(
      Environment.StateMachines.AudioAnalysis,
      response.data,
      this.context
    );
    this.token = response.token;
    /* #3: send task result to state machine execution */
    await this.parent.sendTaskSuccess();
    /* #4: remove record from service token table */
    await ServiceToken.unregister(this.backlogId).catch(() => undefined);
    return this.stateData.toJSON();
  }
}

module.exports = ComprehendStatusChangeEvent;
