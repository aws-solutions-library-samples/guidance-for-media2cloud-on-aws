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
  ModerationItem,
} = require('../trackItem');

/**
 * @class Moderation
 */
class Moderation extends BaseRekognition {
  constructor(stateData) {
    super('moderation', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Moderation';
  }

  get propList() {
    return 'ModerationLabels';
  }

  get propName() {
    return 'ModerationLabel';
  }

  get propKey() {
    return 'ParentName';
  }

  async startJob() {
    const data = (this.stateData.input || {}).aiOptions || {};
    const fn = this.instance.startContentModeration.bind(this.instance);
    return super.startJob(fn, {
      MinConfidence: data.minConfidence || this.minConfidence,
    });
  }

  async checkJobStatus() {
    const fn = this.instance.getContentModeration.bind(this.instance);
    return super.checkJobStatus(fn);
  }

  async collectJobResults(...args) {
    const fn = this.instance.getContentModeration.bind(this.instance);
    return super.collectJobResults(fn);
  }

  storeUniqueMappings(response, filename) {
    let keys = (response.ModerationLabels || []).map(x =>
      (x.ModerationLabel || {}).ParentName).filter(x => x);
    keys = [...new Set(keys)]; // make sure keys are unique
    keys.forEach((key) => {
      this.collection[key] = this.collection[key] || [];
      this.collection[key].push(filename);
    });
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].ModerationLabels[*] s WHERE s.ModerationLabel.ParentName = '${name}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    const response = await super.downloadJson(bucket, key);
    return ((response || {}).ModerationLabels || []).filter(x =>
      ((x.ModerationLabel || {}).ParentName === name));
  }

  createTrackItem(item) {
    return new ModerationItem(this.propName, item);
  }

  cueText(name, item) {
    const child = (item.child) ? `\n<c.small>${item.child}</c>` : '';
    return `<c.${this.keyword}>${name}</c>\n<c.confidence>(${Number.parseFloat(item.confidence).toFixed(2)})</c>${child}`;
  }
}

module.exports = {
  Moderation,
};
