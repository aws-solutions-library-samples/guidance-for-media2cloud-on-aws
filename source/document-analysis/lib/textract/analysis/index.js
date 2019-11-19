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
  BaseTextract,
} = require('../base');

/**
 * @class Analysis
 */
class Analysis extends BaseTextract {
  constructor(stateData) {
    super('analysis', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Analysis';
  }

  async startJob() {
    const fn = this.instance.startDocumentAnalysis.bind(this.instance);
    return super.startJob(fn, {
      FeatureTypes: [
        'TABLES',
        'FORMS',
      ],
    });
  }

  async checkJobStatus() {
    const fn = this.instance.getDocumentAnalysis.bind(this.instance);
    return super.checkJobStatus(fn);
  }

  async collectJobResults(...args) {
    const fn = this.instance.getDocumentAnalysis.bind(this.instance);
    return super.collectJobResults(fn);
  }
}

module.exports = {
  Analysis,
};
