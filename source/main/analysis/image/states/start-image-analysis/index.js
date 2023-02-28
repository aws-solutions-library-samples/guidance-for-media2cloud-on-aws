// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const PATH = require('path');
const {
  StateData,
  AnalysisTypes,
  AnalysisError,
  CommonUtils,
  Retry,
  Environment,
} = require('core-lib');
const {
  SigV4,
} = require('core-lib');

const ANALYSIS_TYPE = 'image';
const CATEGORY = 'rekog-image';
const SUB_CATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUB_CATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUB_CATEGORY_FACE_MATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUB_CATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUB_CATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const SUB_CATEGORY_TEXT = AnalysisTypes.Rekognition.Text;
const MIN_CONFIDENCE = 80;
const OUTPUT_JSON = 'output.json';

class StateStartImageAnalysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  static createInstance() {
    return new AWS.Rekognition({
      apiVersion: '2016-06-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartImageAnalysis';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const aiOptions = this.stateData.input.aiOptions;
    let results = Promise.all([
      this.startCeleb(aiOptions),
      this.startFace(aiOptions),
      this.startFaceMatch(aiOptions),
      this.startLabel(aiOptions),
      this.startModeration(aiOptions),
      this.startText(aiOptions),
    ]);

    results = (await results)
      .filter((x) =>
        x)
      .reduce((acc, cur) => ({
        ...acc,
        ...cur,
      }), {});

    this.stateData.setData(ANALYSIS_TYPE, {
      status: StateData.Statuses.Completed,
      [CATEGORY]: results,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async startCeleb(aiOptions) {
    if (!aiOptions.celeb) {
      return undefined;
    }
    const rekog = StateStartImageAnalysis.createInstance();
    const fn = rekog.recognizeCelebrities.bind(rekog);
    const params = this.makeParams();
    return this.startFn(SUB_CATEGORY_CELEB, fn, params);
  }

  async startFace(aiOptions) {
    if (!aiOptions.face) {
      return undefined;
    }
    const rekog = StateStartImageAnalysis.createInstance();
    const fn = rekog.detectFaces.bind(rekog);
    const params = {
      ...this.makeParams(),
      Attributes: [
        'ALL',
      ],
    };
    return this.startFn(SUB_CATEGORY_FACE, fn, params);
  }

  async startFaceMatch(aiOptions) {
    if (!aiOptions[AnalysisTypes.Rekognition.FaceMatch] || !aiOptions.faceCollectionId) {
      return undefined;
    }
    const rekog = StateStartImageAnalysis.createInstance();
    /* ensure face collection exists and has faces */
    const collectionReady = await rekog.describeCollection({
      CollectionId: aiOptions.faceCollectionId,
    }).promise()
      .then(data => data.FaceCount > 0)
      .catch(() => false);

    if (!collectionReady) {
      return undefined;
    }
    const fn = rekog.searchFacesByImage.bind(rekog);
    const params = {
      ...this.makeParams(),
      CollectionId: aiOptions.faceCollectionId,
      FaceMatchThreshold: aiOptions.minConfidence || MIN_CONFIDENCE,
    };
    return this.startFn(SUB_CATEGORY_FACE_MATCH, fn, params);
  }

  async startLabel(aiOptions) {
    if (!aiOptions.label) {
      return undefined;
    }
    const rekog = StateStartImageAnalysis.createInstance();
    const fn = rekog.detectLabels.bind(rekog);
    const params = {
      ...this.makeParams(),
      MinConfidence: aiOptions.minConfidence || MIN_CONFIDENCE,
    };
    return this.startFn(SUB_CATEGORY_LABEL, fn, params);
  }

  async startModeration(aiOptions) {
    if (!aiOptions.moderation) {
      return undefined;
    }
    const rekog = StateStartImageAnalysis.createInstance();
    const fn = rekog.detectModerationLabels.bind(rekog);
    const params = {
      ...this.makeParams(),
      MinConfidence: aiOptions.minConfidence || MIN_CONFIDENCE,
    };
    return this.startFn(SUB_CATEGORY_MODERATION, fn, params);
  }

  async startText(aiOptions) {
    if (!aiOptions.text) {
      return undefined;
    }
    const rekog = StateStartImageAnalysis.createInstance();
    const fn = rekog.detectText.bind(rekog);
    const params = this.makeParams();
    return this.startFn(SUB_CATEGORY_TEXT, fn, params);
  }

  makeParams() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.input.image.key;
    if (!bucket || !key) {
      throw new AnalysisError('bucket or key is missing');
    }
    return {
      Image: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
    };
  }

  async startFn(subCategory, fn, params) {
    const t0 = new Date().getTime();
    const response = await Retry.run(fn, params).catch(e => e);
    if (response instanceof Error) {
      return {
        [subCategory]: {
          errorMessage: response.message,
        },
      };
    }

    const bucket = this.stateData.input.destination.bucket;
    const prefix = this.makeOutputPrefix(subCategory);
    await CommonUtils.uploadFile(bucket, prefix, OUTPUT_JSON, response);
    return {
      [subCategory]: {
        output: PATH.join(prefix, OUTPUT_JSON),
        startTime: t0,
        endTime: new Date().getTime(),
      },
    };
  }

  makeOutputPrefix(subCategory) {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.destination.prefix,
      'raw',
      timestamp,
      CATEGORY,
      subCategory,
      '/'
    );
  }
}

module.exports = StateStartImageAnalysis;
