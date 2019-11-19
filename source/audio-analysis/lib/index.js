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
/* eslint-disable no-plusplus */

const {
  StateData,
  AnalysisError,
} = require('m2c-core-lib');

const {
  Transcribe,
} = require('./transcribe');

const {
  Comprehend,
} = require('./comprehend');

/**
 * @class AudioAnalysis
 */
class AudioAnalysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }

    this.$stateData = stateData;
    this.$transcribe = new Transcribe(stateData);
    this.$comprehend = new Comprehend(stateData);
  }

  get [Symbol.toStringTag]() {
    return 'AudioAnalysis';
  }

  get stateData() {
    return this.$stateData;
  }

  get transcribe() {
    return this.$transcribe;
  }

  get comprehend() {
    return this.$comprehend;
  }
}

module.exports = {
  AudioAnalysis,
};
