// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  StateData,
  AnalysisError,
  AnalysisTypes,
} = require('core-lib');
const DetectCelebIterator = require('./iterators/detect-celeb');
const DetectFaceIterator = require('./iterators/detect-face');
const DetectFaceMatchIterator = require('./iterators/detect-face-match');
const DetectLabelIterator = require('./iterators/detect-label');
const DetectModerationIterator = require('./iterators/detect-moderation');
const DetectTextIterator = require('./iterators/detect-text');
/* run celeb and facematch detection based on face results */
const DetectIdentityComboIterator = require('./iterators/detect-identity-combo');

const SUBCATEGORY_CELEB = AnalysisTypes.Rekognition.Celeb;
const SUBCATEGORY_FACE = AnalysisTypes.Rekognition.Face;
const SUBCATEGORY_FACEMATCH = AnalysisTypes.Rekognition.FaceMatch;
const SUBCATEGORY_LABEL = AnalysisTypes.Rekognition.Label;
const SUBCATEGORY_MODERATION = AnalysisTypes.Rekognition.Moderation;
const SUBCATEGORY_TEXT = AnalysisTypes.Rekognition.Text;

class StateDetectFrameIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateDetectFrameIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const data = this.stateData.data;
    const iterator = (data[SUBCATEGORY_LABEL])
      ? new DetectLabelIterator(this.stateData)
      : (data[SUBCATEGORY_MODERATION])
        ? new DetectModerationIterator(this.stateData)
        : (data[SUBCATEGORY_TEXT])
          ? new DetectTextIterator(this.stateData)
          /* use combo detection */
          : (data[SUBCATEGORY_FACE] && (data[SUBCATEGORY_CELEB] || data[SUBCATEGORY_FACEMATCH]))
            ? new DetectIdentityComboIterator(this.stateData)
            /* no combo detection */
            : (data[SUBCATEGORY_CELEB])
              ? new DetectCelebIterator(this.stateData)
              : (data[SUBCATEGORY_FACE])
                ? new DetectFaceIterator(this.stateData)
                : (data[SUBCATEGORY_FACEMATCH])
                  ? new DetectFaceMatchIterator(this.stateData)
                  : undefined;
    if (!iterator) {
      const e = `iterator '${Object.keys(data).join(',')}' not impl`;
      console.error(e);
      throw new AnalysisError(e);
    }
    return iterator.process();
  }
}

module.exports = StateDetectFrameIterator;
