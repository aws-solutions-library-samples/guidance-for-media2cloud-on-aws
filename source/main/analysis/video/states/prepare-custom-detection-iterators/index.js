// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  StateData,
  AnalysisTypes: {
    Rekognition: {
      CustomLabel,
      Segment,
    },
    Scene,
  },
  FrameCaptureMode,
  FrameCaptureModeHelper,
  CommonUtils,
  M2CException,
} = require('core-lib');

const FRAMECAPTURE_GROUP = 'frameCapture';
const ITERATORS = 'iterators';
const DEFAULT_INFERENCEUNITS = 5;
const OPT_FRAMECAPTUREMODE = 'frameCaptureMode';
const OPT_CUSTOMLABELMODELS = 'customLabelModels';
const OPT_FRAMESEGMENTATION = 'framesegmentation';

const JSON_FRAMESEGMENTATION = `${OPT_FRAMESEGMENTATION}.json`;
const JSON_SCENE_EMBEDDINGS = 'scene_embeddings.json';
const JSON_SCENE_SIMILARITY = 'scene_similarity.json';

const {
  Statuses: {
    NotStarted,
  },
  States: {
    StartDetectionIterator,
  },
} = StateData;

class StatePrepareCustomDetectionIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
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
    const {
      input: {
        uuid,
        destination: {
          bucket: proxyBucket,
          prefix: proxyPrefix,
        },
        video: {
          key: videoKey,
        },
        duration,
        framerate,
        request: {
          timestamp: requestTime,
        },
        aiOptions: {
          [CustomLabel]: customLabelFeature,
          [OPT_CUSTOMLABELMODELS]: customLabelModels = [],
          [OPT_FRAMECAPTUREMODE]: frameCaptureMode = FrameCaptureMode.MODE_NONE,
          [Scene]: sceneFeature,
          minConfidence,
          inferenceUnits = DEFAULT_INFERENCEUNITS,
          filters = {},
        },
      },
      data: {
        [OPT_FRAMESEGMENTATION]: framesegmentation = undefined,
        [Segment]: segment = undefined,
      },
    } = this.stateData;

    const iterators = [];
    const promisePurgePreviousRun = [];

    // frame capture mode must not be MODE_NONE
    if (frameCaptureMode === FrameCaptureMode.MODE_NONE) {
      return this.resetStateData();
    }

    const framePrefix = PATH.join(
      PATH.parse(videoKey).dir,
      '..',
      FRAMECAPTURE_GROUP,
      '/'
    );

    const genericData = {
      uuid,
      operation: StartDetectionIterator,
      status: NotStarted,
      progress: 0,
      input: {
        destination: {
          bucket: proxyBucket,
          prefix: proxyPrefix,
        },
      },
    };

    // scene detection feature
    if (framesegmentation !== undefined && segment !== undefined) {
      if (sceneFeature) {
        const iterator = {
          ...genericData,
          data: {
            [Scene]: {
              bucket: proxyBucket,
              prefix: framePrefix,
              json: JSON_FRAMESEGMENTATION,
              embeddings: JSON_SCENE_EMBEDDINGS,
              similarity: JSON_SCENE_SIMILARITY,
              filterSettings: filters[Scene],
            },
            [Segment]: segment,
            [OPT_FRAMESEGMENTATION]: framesegmentation,
          },
        };
        iterators.push(iterator);

        // remove embeddings and similarity output from previous run
        [JSON_SCENE_EMBEDDINGS, JSON_SCENE_SIMILARITY].forEach((key) => {
          // eslint-disable-next-line
          // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          const jsonKey = PATH.join(framePrefix, key);
          promisePurgePreviousRun.push(CommonUtils.deleteObject(
            proxyBucket,
            jsonKey
          ).catch(() =>
            undefined));
        });
      }
    }

    // custom label models enabled
    if (customLabelFeature) {
      const frameCaptureData = await this.getFrameCaptureData(
        proxyBucket,
        framePrefix
      );

      let sampling = frameCaptureData.denominator / frameCaptureData.numerator;
      sampling = Math.round(sampling * 1000);

      const iteratorData = {
        bucket: proxyBucket,
        prefix: proxyPrefix,
        key: videoKey,
        duration,
        frameCaptureMode,
        framerate,
        requestTime,
        minConfidence,
        inferenceUnits,
        frameCapture: {
          prefix: framePrefix,
          ...frameCaptureData,
        },
        sampling,
        cursor: 0,
        numOutputs: 0,
      };

      customLabelModels.forEach((model) => {
        const iterator = {
          ...genericData,
          data: {
            [CustomLabel]: {
              [OPT_CUSTOMLABELMODELS]: model,
              ...iteratorData,
              filterSettings: filters[CustomLabel],
            },
          },
        };
        iterators.push(iterator);
      });
    }

    if (iterators.length === 0) {
      return this.resetStateData();
    }

    this.stateData.input = undefined;
    this.stateData.data = undefined;
    this.stateData.data = {
      [ITERATORS]: iterators,
    };

    // remove outputs created from previous run
    await Promise.all(promisePurgePreviousRun);

    return this.stateData.toJSON();
  }

  resetStateData() {
    this.stateData.input = undefined;
    this.stateData.data = undefined;
    this.stateData.data = {
      [ITERATORS]: [],
    };

    return this.stateData.toJSON();
  }

  async getFrameCaptureData(bucket, prefix) {
    // #1: get total frames to process
    let response;
    let numFrames = 0;

    do {
      response = await CommonUtils.listObjects(
        bucket,
        prefix,
        {
          MaxKeys: 1000,
          ContinuationToken: (response || {}).NextContinuationToken,
        }
      );

      numFrames += response.Contents
        .filter((x) =>
          PATH.parse(x.Key).ext === '.jpg')
        .length;
    } while ((response || {}).NextContinuationToken);

    if (!numFrames) {
      throw new M2CException(`fail to find frame under ${prefix}`);
    }

    // #2: get frame capture rate
    const {
      input: {
        framerate,
        aiOptions: {
          [OPT_FRAMECAPTUREMODE]: frameCaptureMode,
        },
      },
    } = this.stateData;

    const [
      numerator,
      denominator,
    ] = FrameCaptureModeHelper.suggestFrameCaptureRate(
      framerate,
      frameCaptureMode
    );

    return {
      numFrames,
      numerator,
      denominator,
    };
  }
}

module.exports = StatePrepareCustomDetectionIterators;
