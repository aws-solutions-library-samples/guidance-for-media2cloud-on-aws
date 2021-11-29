// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  StateData,
  ChecksumError,
} = require('core-lib');
const SHA1Lib = require('./algorithm/sha1');
const MD5Lib = require('./algorithm/md5');

class StateComputeChecksum {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new ChecksumError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateComputeChecksum';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const algorithm = ((this.stateData.input || {}).checksum || {}).algorithm || 'md5';
    const instance = (algorithm === 'sha1')
      ? new SHA1Lib(this.stateData)
      : new MD5Lib(this.stateData);
    return instance.compute();
  }
}

module.exports = StateComputeChecksum;
