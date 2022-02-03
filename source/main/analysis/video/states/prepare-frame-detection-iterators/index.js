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
  AnalysisError,
  AnalysisTypes,
  FrameCaptureModeHelper,
  Environment,
} = require('core-lib');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUBCATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUBCATEGORY_TEXT = AnalysisTypes.Rekognition.Text;
const SUBCATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const FRAMECAPTURE_GROUP = 'frameCapture';
const ITERATORS = 'iterators';

class StatePrepareFrameDetectionIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StatePrepareFrameDetectionIterators';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const input = this.stateData.input;
    const aiOptions = input.aiOptions;
    if (!aiOptions.framebased || !aiOptions.frameCaptureMode) {
      return this.emptyIterators();
    }
    const bucket = input.destination.bucket;
    const prefix = PATH.join(
      PATH.parse(input.video.key).dir,
      '..',
      FRAMECAPTURE_GROUP,
      '/'
    );
    const key = input.video.key;
    const stateData = {
      uuid: input.uuid,
      status: StateData.Statuses.NotStarted,
      progress: 0,
    };
    const frameCaptureData = await this.getFrameCaptureData(bucket, prefix);
    const sampling = Math.round((frameCaptureData.denominator / frameCaptureData.numerator) * 1000);
    const iteratorData = {
      bucket,
      prefix: input.destination.prefix,
      key,
      duration: input.duration,
      frameCaptureMode: aiOptions.frameCaptureMode,
      framerate: input.framerate,
      requestTime: input.request.timestamp,
      minConfidence: aiOptions.minConfidence,
      frameCapture: {
        prefix,
        ...frameCaptureData,
      },
      sampling,
      cursor: 0,
      numOutputs: 0,
    };
    let iterators = [
      this.makeLabelParams(aiOptions, stateData, iteratorData),
      this.makeModerationParams(aiOptions, stateData, iteratorData),
      this.makeTextParams(aiOptions, stateData, iteratorData),
    ];
    /* combo analysis: run celeb and facematch detection based on face detection result */
    if (aiOptions[SUBCATEGORY_FACE]
      && (aiOptions[SUBCATEGORY_CELEB] || aiOptions[SUBCATEGORY_FACEMATCH])) {
      iterators.push(this.makeIdentityComboParams(aiOptions, stateData, iteratorData));
    } else {
      /* run individual detection in parallel */
      iterators.push(this.makeCelebParams(aiOptions, stateData, iteratorData));
      iterators.push(this.makeFaceParams(aiOptions, stateData, iteratorData));
      iterators.push(this.makeFaceMatchParams(aiOptions, stateData, iteratorData));
    }
    iterators = iterators.filter(x => (typeof x === 'object'));
    this.stateData.input = undefined;
    this.stateData.data = undefined;
    this.stateData.data = {
      [ITERATORS]: iterators,
    };
    return this.stateData.toJSON();
  }

  emptyIterators() {
    this.stateData.input = undefined;
    this.stateData.data = {
      [ITERATORS]: [],
    };
    return this.stateData.toJSON();
  }

  makeLabelParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_LABEL, aiOptions, stateData, iteratorData);
  }

  makeModerationParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_MODERATION, aiOptions, stateData, iteratorData);
  }

  makeTextParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(SUBCATEGORY_TEXT, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[SUBCATEGORY_TEXT].textROI = aiOptions.textROI;
    }
    return params;
  }

  makeFaceParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_FACE, aiOptions, stateData, iteratorData);
  }

  makeCelebParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_CELEB, aiOptions, stateData, iteratorData);
  }

  makeFaceMatchParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(SUBCATEGORY_FACEMATCH, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[SUBCATEGORY_FACEMATCH].faceCollectionId = aiOptions.faceCollectionId;
    }
    return params;
  }

  makeParams(subcategory, aiOptions, stateData, iteratorData) {
    return aiOptions[subcategory]
      && {
        ...stateData,
        data: {
          [subcategory]: {
            ...iteratorData,
          },
        },
      };
  }

  makeIdentityComboParams(aiOptions, stateData, iteratorData) {
    const combo = [
      this.makeFaceParams(aiOptions, stateData, iteratorData),
      this.makeCelebParams(aiOptions, stateData, iteratorData),
      this.makeFaceMatchParams(aiOptions, stateData, iteratorData),
    ].filter(x => (typeof x === 'object'));
    const data = combo.reduce((a0, c0) => ({
      ...a0,
      ...c0.data,
    }), {});
    return {
      ...stateData,
      data: {
        ...data,
      },
    };
  }

  async getFrameCaptureData(bucket, prefix) {
    const input = this.stateData.input;
    /* #1: get total frames to process */
    let response;
    let numFrames = 0;
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    do {
      response = await s3.listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: (response || {}).NextContinuationToken,
        ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
      }).promise();
      numFrames += response.Contents.filter(x =>
        PATH.parse(x.Key).ext === '.jpg').length;
    } while ((response || {}).NextContinuationToken);
    if (!numFrames) {
      throw new AnalysisError(`fail to find frame under ${prefix}`);
    }
    /* #2: get frame capture rate */
    const framerate = input.framerate;
    const frameCaptureMode = (input.aiOptions || {}).frameCaptureMode;
    const [
      numerator,
      denominator,
    ] = FrameCaptureModeHelper.suggestFrameCaptureRate(framerate, frameCaptureMode);
    return {
      numFrames,
      numerator,
      denominator,
    };
  }
}

module.exports = StatePrepareFrameDetectionIterators;
