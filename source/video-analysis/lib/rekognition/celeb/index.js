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
/* eslint-disable no-continue */
const {
  CommonUtils,
} = require('m2c-core-lib');

const {
  BaseRekognition,
} = require('../base');

/**
 * @class Celeb
 */
class Celeb extends BaseRekognition {
  constructor(stateData) {
    super('celeb', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Celeb';
  }

  get propList() {
    return 'Celebrities';
  }

  get propName() {
    return 'Celebrity';
  }

  get propKey() {
    return 'Name';
  }

  async startJob() {
    const fn = this.instance.startCelebrityRecognition.bind(this.instance);
    return super.startJob(fn);
  }

  async checkJobStatus() {
    const fn = this.instance.getCelebrityRecognition.bind(this.instance);
    return super.checkJobStatus(fn);
  }

  async collectJobResults(...args) {
    const fn = this.instance.getCelebrityRecognition.bind(this.instance);
    return super.collectJobResults(fn);
  }

  storeUniqueMappings(response, filename) {
    let keys = (response.Celebrities || []).map(x => (x.Celebrity || {}).Name).filter(x => x);
    keys = [...new Set(keys)]; // make sure keys are unique
    keys.forEach((key) => {
      this.collection[key] = this.collection[key] || [];
      this.collection[key].push(filename);
    });
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].Celebrities[*] s WHERE s.Celebrity.Name = '${name}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const response = await super.downloadJson(bucket, key);
    return ((response || {}).Celebrities || []).filter(x =>
      ((x.Celebrity || {}).Name === name));
  }
}

module.exports = {
  Celeb,
};
