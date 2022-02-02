// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
} = require('core-lib');

const ANALYSIS_TYPE = 'video';

class StateJobCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateJobCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    /* reformatting output */
    const rekognition = this.stateData.data.rekognition;
    const video = {
      status: StateData.Statuses.Completed,
      startTime: new Date(this.stateData.event.startTime).getTime(),
      endTime: new Date().getTime(),
      executionArn: this.stateData.event.executionArn,
      rekognition,
    };
    delete this.stateData.data.rekognition;
    this.stateData.setData(ANALYSIS_TYPE, video, false);
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateJobCompleted;
