// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  StateData,
  AnalysisError,
  AnalysisTypes,
} = require('core-lib');
const IndexCelebIterator = require('./iterators/index-celeb');
const IndexFaceIterator = require('./iterators/index-face');
const IndexFaceMatchIterator = require('./iterators/index-face-match');
const IndexLabelIterator = require('./iterators/index-label');
const IndexModerationIterator = require('./iterators/index-moderation');
const IndexPersonIterator = require('./iterators/index-person');
const IndexSegmentIterator = require('./iterators/index-segment');
const IndexTextIterator = require('./iterators/index-text');
const IndexCustomLabelIterator = require('./iterators/index-custom-label');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUBCATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUBCATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const SUBCATEGORY_PERSON = AnalysisTypes.Rekognition.Person;
const SUBCATEGORY_SEGMENT = AnalysisTypes.Rekognition.Segment;
const SUBCATEGORY_TEXT = AnalysisTypes.Rekognition.Text;
const SUBCATEGORY_CUSTOMLABEL = AnalysisTypes.Rekognition.CustomLabel;

class StateIndexAnalysisIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateIndexAnalysisIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const data = this.stateData.data;
    const iterator = (data[SUBCATEGORY_CELEB])
      ? new IndexCelebIterator(this.stateData)
      : (data[SUBCATEGORY_FACE])
        ? new IndexFaceIterator(this.stateData)
        : (data[SUBCATEGORY_FACEMATCH])
          ? new IndexFaceMatchIterator(this.stateData)
          : (data[SUBCATEGORY_LABEL])
            ? new IndexLabelIterator(this.stateData)
            : (data[SUBCATEGORY_MODERATION])
              ? new IndexModerationIterator(this.stateData)
              : (data[SUBCATEGORY_PERSON])
                ? new IndexPersonIterator(this.stateData)
                : (data[SUBCATEGORY_SEGMENT])
                  ? new IndexSegmentIterator(this.stateData)
                  : (data[SUBCATEGORY_TEXT])
                    ? new IndexTextIterator(this.stateData)
                    : (data[SUBCATEGORY_CUSTOMLABEL])
                      ? new IndexCustomLabelIterator(this.stateData)
                      : undefined;
    if (!iterator) {
      const e = `iterator '${Object.keys(data).join(',')}' not impl`;
      console.error(e);
      throw new AnalysisError(e);
    }
    return iterator.process();
  }
}

module.exports = StateIndexAnalysisIterator;
