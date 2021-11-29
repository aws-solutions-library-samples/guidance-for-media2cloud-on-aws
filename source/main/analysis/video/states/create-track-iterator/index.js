// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  StateData,
  AnalysisError,
  AnalysisTypes,
} = require('core-lib');
const CreateCelebTrackIterator = require('./iterators/create-celeb-track');
const CreateFaceTrackIterator = require('./iterators/create-face-track');
const CreateFaceMatchTrackIterator = require('./iterators/create-face-match-track');
const CreateLabelTrackIterator = require('./iterators/create-label-track');
const CreateModerationTrackIterator = require('./iterators/create-moderation-track');
const CreatePersonTrackIterator = require('./iterators/create-person-track');
const CreateSegmentTrackIterator = require('./iterators/create-segment-track');
const CreateTextTrackIterator = require('./iterators/create-text-track');
const CreateCustomLabelTrackIterator = require('./iterators/create-custom-label-track');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUBCATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUBCATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const SUBCATEGORY_PERSON = AnalysisTypes.Rekognition.Person;
const SUBCATEGORY_SEGMENT = AnalysisTypes.Rekognition.Segment;
const SUBCATEGORY_TEXT = AnalysisTypes.Rekognition.Text;
const SUBCATEGORY_CUSTOMLABEL = AnalysisTypes.Rekognition.CustomLabel;

class StateCreateTrackIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateCreateTrackIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const data = this.stateData.data;
    const iterator = (data[SUBCATEGORY_CELEB])
      ? new CreateCelebTrackIterator(this.stateData)
      : (data[SUBCATEGORY_FACE])
        ? new CreateFaceTrackIterator(this.stateData)
        : (data[SUBCATEGORY_FACEMATCH])
          ? new CreateFaceMatchTrackIterator(this.stateData)
          : (data[SUBCATEGORY_LABEL])
            ? new CreateLabelTrackIterator(this.stateData)
            : (data[SUBCATEGORY_MODERATION])
              ? new CreateModerationTrackIterator(this.stateData)
              : (data[SUBCATEGORY_PERSON])
                ? new CreatePersonTrackIterator(this.stateData)
                : (data[SUBCATEGORY_SEGMENT])
                  ? new CreateSegmentTrackIterator(this.stateData)
                  : (data[SUBCATEGORY_TEXT])
                    ? new CreateTextTrackIterator(this.stateData)
                    : (data[SUBCATEGORY_CUSTOMLABEL])
                      ? new CreateCustomLabelTrackIterator(this.stateData)
                      : undefined;
    if (!iterator) {
      const e = `iterator '${Object.keys(data).join(',')}' not impl`;
      console.error(e);
      throw new AnalysisError(e);
    }
    return iterator.process();
  }
}

module.exports = StateCreateTrackIterator;
