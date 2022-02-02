// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
} = require('core-lib');

class StateCollectAnalysisResults {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateCollectAnalysisResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateCollectAnalysisResults;
