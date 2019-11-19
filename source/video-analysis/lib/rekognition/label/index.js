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
  CommonUtils,
} = require('m2c-core-lib');

const {
  BaseRekognition,
} = require('../base');

const {
  LabelItem,
} = require('../trackItem');

/**
 * @class Label
 */
class Label extends BaseRekognition {
  constructor(stateData) {
    super('label', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Label';
  }

  get propList() {
    return 'Labels';
  }

  get propName() {
    return 'Label';
  }

  get propKey() {
    return 'Name';
  }

  async startJob() {
    const data = (this.stateData.input || {}).aiOptions || {};
    const fn = this.instance.startLabelDetection.bind(this.instance);
    return super.startJob(fn, {
      MinConfidence: data.minConfidence || this.minConfidence,
    });
  }

  async checkJobStatus() {
    const fn = this.instance.getLabelDetection.bind(this.instance);
    return super.checkJobStatus(fn);
  }

  async collectJobResults(...args) {
    const fn = this.instance.getLabelDetection.bind(this.instance);
    return super.collectJobResults(fn);
  }

  storeUniqueMappings(response, filename) {
    let keys = (response.Labels || []).map(x =>
      (x.Label || {}).Name).filter(x => x);
    keys = [...new Set(keys)]; // make sure keys are unique
    keys.forEach((key) => {
      this.collection[key] = this.collection[key] || [];
      this.collection[key].push(filename);
    });
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].Labels[*] s WHERE s.Label.Name = '${name}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const response = await super.downloadJson(bucket, key);
    return ((response || {}).Labels || []).filter(x =>
      ((x.Label || {}).Name === name));
  }

  createTrackItem(item) {
    return new LabelItem(this.propName, item);
  }

  cueText(name, item) {
    const parents = (item.parents.length) ? `\n<c.small>${item.parents.join(', ')}</c>` : '';
    return `<c.${this.keyword}>${name}</c>\n<c.confidence>(${Number.parseFloat(item.confidence).toFixed(2)})</c>${parents}`;
  }
}

module.exports = {
  Label,
};
