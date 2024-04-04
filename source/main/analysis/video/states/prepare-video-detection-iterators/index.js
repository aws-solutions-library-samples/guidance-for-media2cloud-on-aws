// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      Face,
      FaceMatch,
      Label,
      Moderation,
      Person,
      Segment,
      Text,
    },
  },
  AnalysisError,
  FrameCaptureMode,
} = require('core-lib');

const {
  Statuses: {
    NotStarted,
  },
} = StateData;

const ITERATORS = 'iterators';
const OPT_FRAMEBASED = 'framebased';

class StatePrepareVideoDetectionIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StatePrepareVideoDetectionIterators';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const {
      input: {
        uuid,
        duration,
        framerate,
        aiOptions,
        destination: {
          bucket,
          prefix,
        },
        video: {
          key,
        },
        request: {
          timestamp,
        },
      },
    } = this.stateData;

    const stateData = {
      uuid,
      status: NotStarted,
      progress: 0,
    };

    const iteratorData = {
      bucket,
      prefix,
      key,
      duration,
      framerate,
      requestTime: timestamp,
      minConfidence: aiOptions.minConfidence,
      cursor: 0,
      numOutputs: 0,
    };

    const iterators = [];

    if (!aiOptions[OPT_FRAMEBASED]) {
      iterators.splice(iterators.length, 0, ...[
        this.makeCelebParams(aiOptions, stateData, iteratorData),
        this.makeFaceParams(aiOptions, stateData, iteratorData),
        this.makeFaceMatchParams(aiOptions, stateData, iteratorData),
        this.makeLabelParams(aiOptions, stateData, iteratorData),
        this.makeModerationParams(aiOptions, stateData, iteratorData),
        this.makeTextParams(aiOptions, stateData, iteratorData),
      ]);
    }
    iterators.splice(iterators.length, 0, ...[
      this.makePersonParams(aiOptions, stateData, iteratorData),
      this.makeSegmentParams(aiOptions, stateData, iteratorData),
    ]);
    this.stateData.input = undefined;
    this.stateData.data = undefined;
    this.stateData.data = {
      [ITERATORS]: iterators.filter(x => x),
    };
    return this.stateData.toJSON();
  }

  makeCelebParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Celeb, aiOptions, stateData, iteratorData);
  }

  makeFaceParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Face, aiOptions, stateData, iteratorData);
  }

  makeFaceMatchParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(FaceMatch, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[FaceMatch].faceCollectionId = aiOptions.faceCollectionId;
    }
    return params;
  }

  makeLabelParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Label, aiOptions, stateData, iteratorData);
  }

  makeModerationParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Moderation, aiOptions, stateData, iteratorData);
  }

  makePersonParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(Person, aiOptions, stateData, iteratorData);
  }

  makeSegmentParams(aiOptions, stateData, iteratorData) {
    // if frame based analysis with dynamic frame mode is enabled,
    // let the dynamic-frame-segmentation state machine to run segment detection
    if (aiOptions[OPT_FRAMEBASED]
    && aiOptions.frameCaptureMode === FrameCaptureMode.MODE_DYNAMIC_FPS) {
      return undefined;
    }
    return this.makeParams(Segment, aiOptions, stateData, iteratorData);
  }

  makeTextParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(Text, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[Text].textROI = aiOptions.textROI;
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
}

module.exports = StatePrepareVideoDetectionIterators;
