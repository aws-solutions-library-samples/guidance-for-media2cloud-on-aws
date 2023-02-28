// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  Environment,
  StateData,
  JobStatusError,
  ServiceToken,
} = require('core-lib');
const BacklogStatusChangeEvent = require('./backlogStatusChangeEvent');

const STATUS_SUCCEEDED = 'COMPLETED';
const STATUS_FAILED = 'FAILED';

class TranscribeStatusChangeEvent extends BacklogStatusChangeEvent {
  async process() {
    if (this.status !== STATUS_SUCCEEDED && this.status !== STATUS_FAILED) {
      console.error(`TranscribeStatusChangeEvent.process: ${this.status} status not handled`);
      return undefined;
    }

    const response = await ServiceToken.getData(this.backlogId)
      .catch(() =>
        undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new JobStatusError(`fail to get token, ${this.backlogId}`);
    }

    const category = response.service;
    response.data.data[category].jobId = this.jobId;
    response.data.data[category].endTime = this.timestamp;
    this.stateData = new StateData(
      Environment.StateMachines.AudioAnalysis,
      response.data,
      this.context
    );
    this.token = response.token;

    /* #3: send task result to state machine execution */
    if (this.status === STATUS_SUCCEEDED) {
      this.stateData.setCompleted();
      await this.parent.sendTaskSuccess();
    } else if (this.status === STATUS_FAILED) {
      /* special handling: if language identification is enabled and fails, */
      /* it is likely that the file contains no dialogue. Set it as NO_DATA */
      const identifyLanguageEnabled = !!(this.detail.serviceParams || {}).IdentifyLanguage;
      if (identifyLanguageEnabled) {
        this.stateData.setNoData();
        await this.parent.sendTaskSuccess();
      } else {
        const error = (this.errorMessage)
          ? new JobStatusError(this.errorMessage)
          : new JobStatusError(`${this.jobId} ${this.status}`);
        this.stateData.setFailed(error);
        await this.parent.sendTaskFailure(error);
      }
    }
    /* #4: remove record from service token table */
    await ServiceToken.unregister(this.backlogId)
      .catch(() =>
        undefined);
    return this.stateData.toJSON();
  }
}

module.exports = TranscribeStatusChangeEvent;
