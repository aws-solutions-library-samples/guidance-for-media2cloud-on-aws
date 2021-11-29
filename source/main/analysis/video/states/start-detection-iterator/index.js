// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  StateData,
  AnalysisError,
  AnalysisTypes,
} = require('core-lib');
const StartCelebIterator = require('./iterators/start-celeb');
const StartFaceIterator = require('./iterators/start-face');
const StartFaceMatchIterator = require('./iterators/start-face-match');
const StartLabelIterator = require('./iterators/start-label');
const StartModerationIterator = require('./iterators/start-moderation');
const StartPersonIterator = require('./iterators/start-person');
const StartSegmentIterator = require('./iterators/start-segment');
const StartTextIterator = require('./iterators/start-text');
const StartCustomLabelIterator = require('./iterators/start-custom-label');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUBCATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUBCATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const SUBCATEGORY_PERSON = AnalysisTypes.Rekognition.Person;
const SUBCATEGORY_SEGMENT = AnalysisTypes.Rekognition.Segment;
const SUBCATEGORY_TEXT = AnalysisTypes.Rekognition.Text;
const SUBCATEGORY_CUSTOMLABEL = AnalysisTypes.Rekognition.CustomLabel;

class StateStartDetectionIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateStartDetectionIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const data = this.stateData.data;
    const iterator = (data[SUBCATEGORY_CELEB])
      ? new StartCelebIterator(this.stateData)
      : (data[SUBCATEGORY_FACE])
        ? new StartFaceIterator(this.stateData)
        : (data[SUBCATEGORY_FACEMATCH])
          ? new StartFaceMatchIterator(this.stateData)
          : (data[SUBCATEGORY_LABEL])
            ? new StartLabelIterator(this.stateData)
            : (data[SUBCATEGORY_MODERATION])
              ? new StartModerationIterator(this.stateData)
              : (data[SUBCATEGORY_PERSON])
                ? new StartPersonIterator(this.stateData)
                : (data[SUBCATEGORY_SEGMENT])
                  ? new StartSegmentIterator(this.stateData)
                  : (data[SUBCATEGORY_TEXT])
                    ? new StartTextIterator(this.stateData)
                    : (data[SUBCATEGORY_CUSTOMLABEL])
                      ? new StartCustomLabelIterator(this.stateData)
                      : undefined;
    if (!iterator) {
      const e = `iterator '${Object.keys(data).join(',')}' not impl`;
      console.error(e);
      throw new AnalysisError(e);
    }
    return iterator.process();
  }
}

module.exports = StateStartDetectionIterator;
