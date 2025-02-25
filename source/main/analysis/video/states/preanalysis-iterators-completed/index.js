// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
} = require('core-lib');

class StatePreAnalysisIteratorsCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  static opSupported(op) {
    return op === 'StatePreAnalysisIteratorsCompleted';
  }

  get [Symbol.toStringTag]() {
    return 'StatePreAnalysisIteratorsCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const { data } = this.stateData;

    for (const iterator of data.iterators) {
      for (const [key, value] of Object.entries(iterator)) {
        data[key] = {
          ...data[key],
          ...value,
        };
      }
    }

    delete data.iterators;

    return this.stateData.toJSON();
  }
}

module.exports = StatePreAnalysisIteratorsCompleted;
