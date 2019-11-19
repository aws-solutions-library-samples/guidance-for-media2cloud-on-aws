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
  Environment,
} = require('m2c-core-lib');

const {
  BaseRekognition,
} = require('../base');

const {
  FaceMatchItem,
} = require('../trackItem');

/**
 * @class FaceMatch
 */
class FaceMatch extends BaseRekognition {
  constructor(stateData) {
    super('faceMatch', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'FaceMatch';
  }

  get propList() {
    return 'FaceMatches';
  }

  get propName() {
    return 'Face';
  }

  get propKey() {
    return 'ExternalImageId';
  }

  /**
   * @function ensureCollectionExists
   * @description create collection if not exists
   * @param {string} collectionId
   */
  async ensureCollectionExists(collectionId) {
    return this.instance.createCollection({
      CollectionId: collectionId,
    }).promise().catch((e) => {
      if (e.code !== 'ResourceAlreadyExistsException') {
        throw e;
      }
    });
  }

  async startJob() {
    const data = (this.stateData.input || {}).aiOptions || {};
    const collectionId = data.faceCollectionId || Environment.Rekognition.CollectionId;
    await this.ensureCollectionExists(collectionId);

    const fn = this.instance.startFaceSearch.bind(this.instance);
    return super.startJob(fn, {
      CollectionId: collectionId,
      FaceMatchThreshold: data.minConfidence || this.minConfidence,
    });
  }

  async checkJobStatus() {
    const fn = this.instance.getFaceSearch.bind(this.instance);
    return super.checkJobStatus(fn);
  }

  async collectJobResults(...args) {
    const fn = this.instance.getFaceSearch.bind(this.instance);
    return super.collectJobResults(fn);
  }

  /**
   * @function patchResults
   * @description for FaceMatches result, need to copy
   * the Timestamp from the top level to the FaceMatches block
   */
  patchResults(response) {
    response.Persons.forEach((x) => {
      (x.FaceMatches || []).forEach((x0) => {
        if ((x0.Face || {}).ExternalImageId) {
          x0.Timestamp = x.Timestamp; // eslint-disable-line
        }
      });
    });
    return response;
  }

  storeUniqueMappings(response, filename) {
    let keys = (response.Persons || []).reduce((acc, cur) =>
      acc.concat((cur.FaceMatches || []).map(x0 =>
        (x0.Face || {}).ExternalImageId).filter(x => x)), []);

    keys = [...new Set(keys)]; // make sure keys are unique
    keys.forEach((key) => {
      this.collection[key] = this.collection[key] || [];
      this.collection[key].push(filename);
    });
  }

  async downloadSelected(bucket, key, name) {
    const query = `SELECT * FROM S3Object[*].Persons[*].FaceMatches[*] s WHERE s.Face.ExternalImageId = '${name}';`;
    return CommonUtils.selectS3Content(bucket, key, query).catch(() =>
      this.downloadJson(bucket, key, name));
  }

  async downloadJson(bucket, key, name) {
    let response = await super.downloadJson(bucket, key);

    response = response.Persons.map(x =>
      x.FaceMatches).filter(x => x && x.length);

    response = [].concat(...response).filter(x =>
      (x.Face || {}).ExternalImageId === name);

    return response;
  }

  createTrackItem(item) {
    return new FaceMatchItem(this.propName, item);
  }

  cueText(name, item) {
    const n0 = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<c.${this.keyword}>${n0}</c>\n<c.confidence>(${Number.parseFloat(item.confidence).toFixed(2)})</c>`;
  }
}

module.exports = {
  FaceMatch,
};
