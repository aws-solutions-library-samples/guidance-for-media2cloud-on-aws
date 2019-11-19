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
  Rekognition,
} = require('./rekognition');

/**
 * @class VideoAnalysis
 */
class VideoAnalysis {
  constructor(stateData) {
    this.$rekognition = new Rekognition(stateData);
  }

  get [Symbol.toStringTag]() {
    return 'VideoAnalysis';
  }

  get rekognition() {
    return this.$rekognition;
  }
}

module.exports = {
  VideoAnalysis,
};
