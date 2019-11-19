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
  Text,
} = require('./text');

const {
  Analysis,
} = require('./analysis');

/**
 * @class Textract
 */
class Textract {
  constructor(stateData) {
    this.$stateData = stateData;

    this.$text = undefined;
    this.$analysis = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'Textract';
  }

  get stateData() {
    return this.$stateData;
  }

  get text() {
    if (!this.$text) {
      this.$text = new Text(this.stateData);
    }
    return this.$text;
  }

  get analysis() {
    if (!this.$analysis) {
      this.$analysis = new Analysis(this.stateData);
    }
    return this.$analysis;
  }
}

module.exports = {
  Textract,
};
