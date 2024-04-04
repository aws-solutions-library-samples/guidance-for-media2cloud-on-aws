// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  M2CException,
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
      CustomLabel,
    },
  },
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

class StateStartDetectionIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
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
    const {
      data,
    } = this.stateData;

    let iterator;
    if (data[Celeb]) {
      iterator = new StartCelebIterator(this.stateData);
    } else if (data[Face]) {
      iterator = new StartFaceIterator(this.stateData);
    } else if (data[FaceMatch]) {
      iterator = new StartFaceMatchIterator(this.stateData);
    } else if (data[Label]) {
      iterator = new StartLabelIterator(this.stateData);
    } else if (data[Moderation]) {
      iterator = new StartModerationIterator(this.stateData);
    } else if (data[Person]) {
      iterator = new StartPersonIterator(this.stateData);
    } else if (data[Segment]) {
      iterator = new StartSegmentIterator(this.stateData);
    } else if (data[Text]) {
      iterator = new StartTextIterator(this.stateData);
    } else if (data[CustomLabel]) {
      iterator = new StartCustomLabelIterator(this.stateData);
    } else {
      const message = `iterator for ${Object.keys(data).join(', ')} not supported`;
      console.error(
        'ERR:',
        'StateStartDetectionIterator.process:',
        message
      );
      throw M2CException(message);
    }

    return iterator.process();
  }
}

module.exports = StateStartDetectionIterator;
