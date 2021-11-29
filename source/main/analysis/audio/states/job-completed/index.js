// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  StateData,
  AnalysisError,
} = require('core-lib');

const ANALYSIS_TYPE = 'audio';

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
    const transcribe = this.stateData.data.transcribe;
    const comprehend = this.stateData.data.comprehend;
    const audio = {
      status: StateData.Statuses.Completed,
      startTime: new Date(this.stateData.event.startTime).getTime(),
      endTime: new Date().getTime(),
      executionArn: this.stateData.event.executionArn,
      transcribe,
      comprehend,
    };
    delete this.stateData.data.transcribe;
    delete this.stateData.data.comprehend;
    this.stateData.setData(ANALYSIS_TYPE, audio, false);
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateJobCompleted;
