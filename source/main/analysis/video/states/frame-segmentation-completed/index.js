// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  StateData,
  AnalysisError,
} = require('core-lib');

class StateFrameSegmentationCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  static opSupported(op) {
    return op === 'StateFrameSegmentationCompleted';
  }

  get [Symbol.toStringTag]() {
    return 'StateFrameSegmentationCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const { data } = this.stateData;
    return data;
  }
}

module.exports = StateFrameSegmentationCompleted;
