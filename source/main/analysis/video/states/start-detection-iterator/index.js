// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
    let iterator;
    if (data[SUBCATEGORY_CELEB]) {
      iterator = new StartCelebIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_FACE]) {
      iterator = new StartFaceIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_FACEMATCH]) {
      iterator = new StartFaceMatchIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_LABEL]) {
      iterator = new StartLabelIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_MODERATION]) {
      iterator = new StartModerationIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_PERSON]) {
      iterator = new StartPersonIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_SEGMENT]) {
      iterator = new StartSegmentIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_TEXT]) {
      iterator = new StartTextIterator(this.stateData);
    }
    else if (data[SUBCATEGORY_CUSTOMLABEL]) {
      iterator = new StartCustomLabelIterator(this.stateData);
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

module.exports = StateStartDetectionIterator;
