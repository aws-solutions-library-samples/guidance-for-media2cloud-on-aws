// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  StateData,
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      Face,
      FaceMatch,
      Text,
      Moderation,
      Label,
      ImageProperty,
      Segment,
    },
    AutoFaceIndexer,
  },
  FrameCaptureMode,
  FrameCaptureModeHelper,
  CommonUtils,
  M2CException,
} = require('core-lib');

const FRAME_SEGMENTATION = 'framesegmentation';
const FRAMECAPTURE_GROUP = 'frameCapture';
const ITERATORS = 'iterators';

class StatePrepareFrameDetectionIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
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

    // auto face indexer: index unknown faces
    if (aiOptions[AutoFaceIndexer] && aiOptions[Celeb] && aiOptions[FaceMatch]) {
      iterators.push(this.makeAutoFaceIndexerParams(aiOptions, stateData, iteratorData));
    // combo analysis: run celeb and facematch detection based on face detection result
    } else if (aiOptions[Face] && (aiOptions[Celeb] || aiOptions[FaceMatch])) {
      iterators.push(this.makeIdentityComboParams(aiOptions, stateData, iteratorData));
    // run individual detection in parallel
    } else {
      iterators.push(this.makeCelebParams(aiOptions, stateData, iteratorData));
      iterators.push(this.makeFaceParams(aiOptions, stateData, iteratorData));
      iterators.push(this.makeFaceMatchParams(aiOptions, stateData, iteratorData));
    }

    iterators = iterators
      .filter((x) =>
        (typeof x === 'object'));

    // use dynamic framerate
    if (aiOptions.frameCaptureMode === FrameCaptureMode.MODE_DYNAMIC_FPS) {
      const data = this.stateData.data;

      if ((data[FRAME_SEGMENTATION] || {}).key) {
        iterators.forEach((iterator) => {
          iterator.data = {
            ...iterator.data,
            [FRAME_SEGMENTATION]: data[FRAME_SEGMENTATION],
          };
        });
      }

      if ((data[Segment] || {}).output) {
        iterators.forEach((iterator) => {
          iterator.data = {
            ...iterator.data,
            [Segment]: data[Segment],
          };
        });
      }
    }

    this.emptyIterators();
    this.stateData.data[ITERATORS] = iterators;

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
    const params = this.makeParams(Label, aiOptions, stateData, iteratorData);
    if (params && aiOptions[ImageProperty]) {
      params.data[Label][ImageProperty] = aiOptions[ImageProperty];
    }
    return params;
  }

  makeModerationParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Moderation, aiOptions, stateData, iteratorData);
  }

  makeTextParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(Text, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[Text].textROI = aiOptions.textROI;
    }
    return params;
  }

  makeFaceParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Face, aiOptions, stateData, iteratorData);
  }

  makeCelebParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Celeb, aiOptions, stateData, iteratorData);
  }

  makeFaceMatchParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(FaceMatch, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[FaceMatch].faceCollectionId = aiOptions.faceCollectionId;
    }
    return params;
  }

  makeParams(subcategory, aiOptions, stateData, iteratorData) {
    if (!aiOptions[subcategory]) {
      return undefined;
    }

    let filterSettings;
    if ((aiOptions.filters || {})[subcategory]) {
      filterSettings = aiOptions.filters[subcategory];
    }

    return {
      ...stateData,
      data: {
        [subcategory]: {
          ...iteratorData,
          filterSettings,
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

  makeAutoFaceIndexerParams(aiOptions, stateData, iteratorData) {
    const combo = [
      this.makeCelebParams(aiOptions, stateData, iteratorData),
      this.makeFaceMatchParams(aiOptions, stateData, iteratorData),
    ].filter((x) =>
      (typeof x === 'object'));

    const data = combo
      .reduce((a0, c0) => ({
        ...a0,
        ...c0.data,
      }), {});

    let filterSettings;
    if ((aiOptions.filters || {})[AutoFaceIndexer]) {
      filterSettings = aiOptions.filters[AutoFaceIndexer];
    }
    const autoFaceIndexer = {
      filterSettings,
    };

    return {
      ...stateData,
      data: {
        ...data,
        [AutoFaceIndexer]: autoFaceIndexer,
      },
    };
  }

  async getFrameCaptureData(bucket, prefix) {
    const input = this.stateData.input;
    /* #1: get total frames to process */
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
