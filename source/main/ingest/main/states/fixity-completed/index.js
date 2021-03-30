/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  StateData,
  IngestError,
} = require('core-lib');

class StateFixityCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateFixityCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateFixityCompleted;
