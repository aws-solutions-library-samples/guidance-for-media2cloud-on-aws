// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
    let iterator;
    if (data[SUBCATEGORY_LABEL]) {
      iterator = new DetectLabelIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_MODERATION]) {
      iterator = new DetectModerationIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_TEXT]) {
      iterator = new DetectTextIterator(this.stateData);
    }
    /* use combo detection */
    else if (data[SUBCATEGORY_FACE] && (data[SUBCATEGORY_CELEB] || data[SUBCATEGORY_FACEMATCH])) {
      iterator = new DetectIdentityComboIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_CELEB]) {
      iterator = new DetectCelebIterator(this.stateData)
    }
    /* no combo detection */
    else if (data[SUBCATEGORY_FACE]) {
      iterator = new DetectFaceIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_FACEMATCH]) {
      iterator = new DetectFaceMatchIterator(this.stateData);
    }
    else {
      iterator = undefined;
    }
    if (!iterator) {
      const e = `iterator '${Object.keys(data).join(',')}' not impl`;
      console.error(e);
      throw new AnalysisError(e);
    }
    return iterator.process();
  }
}

module.exports = StateDetectFrameIterator;
