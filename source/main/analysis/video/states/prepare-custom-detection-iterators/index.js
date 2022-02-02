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
  FrameCaptureMode,
  FrameCaptureModeHelper,
  Environment,
} = require('core-lib');

const SUBCATEGORY_CUSTOMLABEL = AnalysisTypes.Rekognition.CustomLabel;
const FRAMECAPTURE_GROUP = 'frameCapture';
const ITERATORS = 'iterators';
const DEFAULT_INFERENCEUNITS = 5;
const OPT_FRAMECAPTUREMODE = 'frameCaptureMode';
const OPT_CUSTOMLABELMODELS = 'customLabelModels';

class StatePrepareCustomDetectionIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StatePrepareCustomDetectionIterators';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const input = this.stateData.input;
    const aiOptions = input.aiOptions;
    /* check criteria */
    if (!aiOptions[SUBCATEGORY_CUSTOMLABEL]
      || !aiOptions[OPT_CUSTOMLABELMODELS] || !aiOptions[OPT_CUSTOMLABELMODELS].length
      || aiOptions[OPT_FRAMECAPTUREMODE] === FrameCaptureMode.MODE_NONE) {
      this.stateData.input = undefined;
      this.stateData.data = undefined;
      this.stateData.data = {
        [ITERATORS]: [],
      };
      return this.stateData.toJSON();
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
      inferenceUnits: aiOptions.inferenceUnits || DEFAULT_INFERENCEUNITS,
      frameCapture: {
        prefix,
        ...frameCaptureData,
      },
      sampling,
      cursor: 0,
      numOutputs: 0,
    };
    const iterators = [];
    const models = [].concat(aiOptions[OPT_CUSTOMLABELMODELS]);
    iterators.splice(iterators.length, 0, ...models.map(x =>
      this.makeCustomLabelParams(x, stateData, iteratorData)));
    this.stateData.input = undefined;
    this.stateData.data = undefined;
    this.stateData.data = {
      [ITERATORS]: iterators.filter(x => x),
    };
    return this.stateData.toJSON();
  }

  makeCustomLabelParams(model, stateData, iteratorData) {
    return {
      ...stateData,
      data: {
        [SUBCATEGORY_CUSTOMLABEL]: {
          [OPT_CUSTOMLABELMODELS]: model,
          ...iteratorData,
        },
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

module.exports = StatePrepareCustomDetectionIterators;
