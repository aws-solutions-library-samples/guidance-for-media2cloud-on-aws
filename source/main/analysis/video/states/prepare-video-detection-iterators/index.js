// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  StateData,
  AnalysisTypes,
  AnalysisError,
} = require('core-lib');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUBCATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUBCATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const SUBCATEGORY_PERSON = AnalysisTypes.Rekognition.Person;
const SUBCATEGORY_SEGMENT = AnalysisTypes.Rekognition.Segment;
const SUBCATEGORY_TEXT = AnalysisTypes.Rekognition.Text;
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
    const input = this.stateData.input;
    const bucket = input.destination.bucket;
    const prefix = input.destination.prefix;
    const key = input.video.key;
    const aiOptions = input.aiOptions;
    const stateData = {
      uuid: input.uuid,
      status: StateData.Statuses.NotStarted,
      progress: 0,
    };
    const iteratorData = {
      bucket,
      prefix,
      key,
      duration: input.duration,
      framerate: input.framerate,
      requestTime: input.request.timestamp,
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
    return this.makeParams(SUBCATEGORY_CELEB, aiOptions, stateData, iteratorData);
  }

  makeFaceParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_FACE, aiOptions, stateData, iteratorData);
  }

  makeFaceMatchParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(SUBCATEGORY_FACEMATCH, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[SUBCATEGORY_FACEMATCH].faceCollectionId = aiOptions.faceCollectionId;
    }
    return params;
  }

  makeLabelParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_LABEL, aiOptions, stateData, iteratorData);
  }

  makeModerationParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_MODERATION, aiOptions, stateData, iteratorData);
  }

  makePersonParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_PERSON, aiOptions, stateData, iteratorData);
  }

  makeSegmentParams(aiOptions, stateData, iteratorData) {
    return this.makeParams(SUBCATEGORY_SEGMENT, aiOptions, stateData, iteratorData);
  }

  makeTextParams(aiOptions, stateData, iteratorData) {
    const params = this.makeParams(SUBCATEGORY_TEXT, aiOptions, stateData, iteratorData);
    if (params) {
      params.data[SUBCATEGORY_TEXT].textROI = aiOptions.textROI;
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
}

module.exports = StatePrepareVideoDetectionIterators;
