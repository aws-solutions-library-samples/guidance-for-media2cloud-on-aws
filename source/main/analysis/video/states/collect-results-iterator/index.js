// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  StateData,
  AnalysisError,
  AnalysisTypes,
} = require('core-lib');
const CollectCelebIterator = require('./iterators/collect-celeb');
const CollectFaceIterator = require('./iterators/collect-face');
const CollectFaceMatchIterator = require('./iterators/collect-face-match');
const CollectLabelIterator = require('./iterators/collect-label');
const CollectModerationIterator = require('./iterators/collect-moderation');
const CollectPersonIterator = require('./iterators/collect-person');
const CollectSegmentIterator = require('./iterators/collect-segment');
const CollectTextIterator = require('./iterators/collect-text');
const CollectCustomLabelIterator = require('./iterators/collect-custom-label');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUBCATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUBCATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const SUBCATEGORY_PERSON = AnalysisTypes.Rekognition.Person;
const SUBCATEGORY_SEGMENT = AnalysisTypes.Rekognition.Segment;
const SUBCATEGORY_TEXT = AnalysisTypes.Rekognition.Text;
const SUBCATEGORY_CUSTOMLABEL = AnalysisTypes.Rekognition.CustomLabel;

class StateCollectResultsIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateCollectResultsIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const data = this.stateData.data;
    const iterator = (data[SUBCATEGORY_CELEB])
      ? new CollectCelebIterator(this.stateData)
      : (data[SUBCATEGORY_FACE])
        ? new CollectFaceIterator(this.stateData)
        : (data[SUBCATEGORY_FACEMATCH])
          ? new CollectFaceMatchIterator(this.stateData)
          : (data[SUBCATEGORY_LABEL])
            ? new CollectLabelIterator(this.stateData)
            : (data[SUBCATEGORY_MODERATION])
              ? new CollectModerationIterator(this.stateData)
              : (data[SUBCATEGORY_PERSON])
                ? new CollectPersonIterator(this.stateData)
                : (data[SUBCATEGORY_SEGMENT])
                  ? new CollectSegmentIterator(this.stateData)
                  : (data[SUBCATEGORY_TEXT])
                    ? new CollectTextIterator(this.stateData)
                    : (data[SUBCATEGORY_CUSTOMLABEL])
                      ? new CollectCustomLabelIterator(this.stateData)
                      : undefined;
    if (!iterator) {
      const e = `iterator '${Object.keys(data).join(',')}' not impl`;
      console.error(e);
      throw new AnalysisError(e);
    }
    return iterator.process();
  }
}

module.exports = StateCollectResultsIterator;
