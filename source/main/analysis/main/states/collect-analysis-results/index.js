/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
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
