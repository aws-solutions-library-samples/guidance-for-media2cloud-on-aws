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
/* eslint-disable no-nested-ternary */
const AWS = require('aws-sdk');
const PATH = require('path');

const {
  Environment,
  CommonUtils,
  StateData,
  Retry,
  AnalysisError,
} = require('m2c-core-lib');

/**
 * @class ImageAnalysis
 */
class ImageAnalysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }

    this.$stateData = stateData;
    this.$instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
  }

  static get ServiceType() {
    return 'rekog-image';
  }

  get [Symbol.toStringTag]() {
    return 'ImageAnalysis';
  }

  get stateData() {
    return this.$stateData;
  }

  get instance() {
    return this.$instance;
  }

  async uploadResult(keyword, data) {
    const output = PATH.join(this.makeOutputPrefix(keyword), 'output.json');
    await CommonUtils.upload({
      Bucket: Environment.Proxy.Bucket,
      Key: output,
      ContentType: 'application/json',
      ContentDisposition: 'attachment; filename="output.json"',
      ServerSideEncryption: 'AES256',
      Body: JSON.stringify(data, null, 2),
    });
    return output;
  }

  async startFn(keyword, fn, params) {
    const t0 = new Date().getTime();
    const response = await Retry.run(fn, params).catch(e => e);
    if (response instanceof Error) {
      return {
        [keyword]: {
          errorMessage: response.message,
        },
      };
    }
    const t1 = new Date().getTime();

    const output = await this.uploadResult(keyword, response).catch(() => undefined);
    return {
      [keyword]: {
        output,
        startTime: t0,
        endTime: t1,
      },
    };
  }

  async startCeleb(aiOptions) {
    if (!aiOptions.celeb) {
      return undefined;
    }

    const fn = this.instance.recognizeCelebrities.bind(this.instance);
    const params = this.makeParams();

    return this.startFn('celeb', fn, params);
  }

  async startFace(aiOptions) {
    if (!aiOptions.face) {
      return undefined;
    }

    const fn = this.instance.detectFaces.bind(this.instance);
    const params = Object.assign(this.makeParams(), {
      Attributes: [
        'ALL',
      ],
    });

    return this.startFn('face', fn, params);
  }

  async startFaceMatch(aiOptions) {
    if (!aiOptions.faceMatch) {
      return undefined;
    }

    const fn = this.instance.searchFacesByImage.bind(this.instance);
    const params = Object.assign(this.makeParams(), {
      CollectionId: aiOptions.faceCollectionId,
      FaceMatchThreshold: aiOptions.minConfidence,
    });

    return this.startFn('faceMatch', fn, params);
  }

  async startLabel(aiOptions) {
    if (!aiOptions.label) {
      return undefined;
    }

    const fn = this.instance.detectLabels.bind(this.instance);
    const params = Object.assign(this.makeParams(), {
      MinConfidence: aiOptions.minConfidence,
    });

    return this.startFn('label', fn, params);
  }

  async startModeration(aiOptions) {
    if (!aiOptions.moderation) {
      return undefined;
    }

    const fn = this.instance.detectModerationLabels.bind(this.instance);
    const params = Object.assign(this.makeParams(), {
      MinConfidence: aiOptions.minConfidence,
    });

    return this.startFn('moderation', fn, params);
  }

  async startText(aiOptions) {
    if (!aiOptions.text) {
      return undefined;
    }

    const fn = this.instance.detectText.bind(this.instance);
    const params = this.makeParams();

    return this.startFn('text', fn, params);
  }


  async startImageAnalysis() {
    const aiOptions = (this.stateData.input || {}).aiOptions || {};

    let results = await Promise.all([
      this.startCeleb(aiOptions),
      this.startFace(aiOptions),
      this.startFaceMatch(aiOptions),
      this.startLabel(aiOptions),
      this.startModeration(aiOptions),
      this.startText(aiOptions),
    ]);

    results = results.filter(x => x).reduce((acc, cur) =>
      Object.assign(acc, cur), {});

    this.stateData.setData(ImageAnalysis.ServiceType, results);

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  async collectImageAnalysisResults() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  makeParams() {
    const image = (this.stateData.input || {}).image || {};

    if (!image.key) {
      throw new AnalysisError('input.image.key is missing');
    }

    return {
      Image: {
        S3Object: {
          Bucket: Environment.Proxy.Bucket,
          Name: image.key,
        },
      },
    };
  }

  makeOutputPrefix(keyword) {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.image.baseDir,
      'raw',
      timestamp,
      ImageAnalysis.ServiceType,
      keyword
    );
  }
}

module.exports = {
  ImageAnalysis,
};
