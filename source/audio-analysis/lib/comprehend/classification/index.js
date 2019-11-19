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
  BaseComprehend,
  AnalysisError,
} = require('../base');

/**
 * @class Classification
 */
class Classification extends BaseComprehend {
  constructor(stateData) {
    super('classification', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Classification';
  }

  get propName() {
    return 'DocumentClassificationJobProperties';
  }

  async startJob() {
    throw new AnalysisError('Classification.startJob not impl');
  }

  async checkJobStatus() {
    throw new AnalysisError('Classification.checkJobStatus not impl');
  }

  async collectJobResults(...args) {
    throw new AnalysisError('Classification.collectJobResults not impl');
  }

  async createTrack(...args) {
    throw new AnalysisError('Classification.createTrack not impl');
  }
}

module.exports = {
  Classification,
};
