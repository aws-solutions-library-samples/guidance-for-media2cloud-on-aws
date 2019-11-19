/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
const PATH = require('path');

const {
  Environment,
  StateData,
  DB,
  CommonUtils,
  ChecksumError,
} = require('m2c-core-lib');

const {
  MD5Lib,
} = require('./algorithm/md5');

const {
  SHA1Lib,
} = require('./algorithm/sha1');

const {
  Validation,
} = require('./validation');

/**
 * @class Checksum
 */
class Checksum {
  constructor(stateData) {
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'Checksum';
  }

  get stateData() {
    return this.$stateData;
  }

  async computeChecksum() {
    const algorithm = ((this.stateData.input || {}).checksum || {}).algorithm || 'md5';
    const instance = (algorithm === 'sha1')
      ? new SHA1Lib(this.stateData)
      : new MD5Lib(this.stateData);

    return instance.compute();
  }

  async validateChecksum() {
    const instance = new Validation(this.stateData);
    return instance.validate();
  }
}

module.exports = {
  Checksum,
};
