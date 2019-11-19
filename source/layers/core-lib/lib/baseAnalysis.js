/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

const {
  AnalysisError,
} = require('./error');

const {
  StateData,
} = require('./stateData');

/**
 * @class BaseAnalysis
 */
class BaseAnalysis {
  constructor(keyword, stateData) {
    if (!keyword) {
      throw new AnalysisError('keyword is missing');
    }

    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }

    this.$keyword = keyword;
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'BaseAnalysis';
  }

  get keyword() {
    return this.$keyword;
  }

  get stateData() {
    return this.$stateData;
  }

  /**
   * @function startJob
   * @description pure function, sub-class to implement
   * @param {function} fn
   * @param {object} options
   */
  async startJob(fn, options) {
    throw new AnalysisError('BaseAnalysis.startJob not impl');
  }

  /**
   * @function checkJobStatus
   * @description pure function, sub-class to implement
   * @param {function} fn
   */
  async checkJobStatus(fn) {
    throw new AnalysisError('BaseAnalysis.checkJobStatus not impl');
  }


  /**
   * @function collectJobResults
   * @description pure function, sub-class to implement
   */
  async collectJobResults(...args) {
    throw new AnalysisError('BaseAnalysis.collectJobResults not impl');
  }
}

module.exports = {
  BaseAnalysis,
};
