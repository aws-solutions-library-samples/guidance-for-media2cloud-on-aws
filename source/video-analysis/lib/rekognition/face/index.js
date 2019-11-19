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

/**
 * @class Face
 */
class Face extends BaseRekognition {
  constructor(stateData) {
    super('face', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Face';
  }

  get propList() {
    return 'Faces';
  }

  get propName() {
    return 'Face';
  }

  /* TODO: NEED TO FIX THIS */
  get propKey() {
    return 'Emotions';
  }

  async startJob() {
    const fn = this.instance.startFaceDetection.bind(this.instance);
    return super.startJob(fn, {
      FaceAttributes: 'ALL',
    });
  }

  async checkJobStatus() {
    const fn = this.instance.getFaceDetection.bind(this.instance);
    return super.checkJobStatus(fn);
  }

  async collectJobResults(...args) {
    const fn = this.instance.getFaceDetection.bind(this.instance);
    return super.collectJobResults(fn, {
      SortBy: undefined,
    });
  }

  /**
   * @override
   * @function storeUniqueMappings
   * @description override base class to handle the propName which is not 'string' type
   * @param {Array} list
   * @param {string} filename
   */
  storeUniqueMappings(response, filename) {
    let keys = (response.Faces || []).map((x) => {
      const item = ((x.Face || {}).Emotions || []).reduce((prev, cur) => {
        if (!prev) {
          return cur;
        }
        return (prev.Confidence > cur.Confidence) ? prev : cur;
      }, undefined);
      return (item || {}).Type;
    }).filter(x => x);

    keys = [...new Set(keys)]; // make sure keys are unique
    keys.forEach((key) => {
      this.collection[key] = this.collection[key] || [];
      this.collection[key].push(filename);
    });
  }

  /**
   * TODO: still need to figure out what to return
   */
  async downloadSelected(bucket, key, name) {
    return undefined;
  }
}

module.exports = {
  Face,
};
