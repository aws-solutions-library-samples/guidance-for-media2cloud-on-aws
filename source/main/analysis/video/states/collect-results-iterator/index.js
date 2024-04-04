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
const CollectCelebIterator = require('./iterators/collect-celeb');
const CollectFaceIterator = require('./iterators/collect-face');
const CollectFaceMatchIterator = require('./iterators/collect-face-match');
const CollectLabelIterator = require('./iterators/collect-label');
const CollectModerationIterator = require('./iterators/collect-moderation');
const CollectPersonIterator = require('./iterators/collect-person');
const CollectSegmentIterator = require('./iterators/collect-segment');
const CollectTextIterator = require('./iterators/collect-text');
const CollectCustomLabelIterator = require('./iterators/collect-custom-label');

class StateCollectResultsIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
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
    const {
      data,
    } = this.stateData;

    let iterator;
    if (data[Celeb]) {
      iterator = new CollectCelebIterator(this.stateData);
    } else if (data[Face]) {
      iterator = new CollectFaceIterator(this.stateData);
    } else if (data[FaceMatch]) {
      iterator = new CollectFaceMatchIterator(this.stateData);
    } else if (data[Label]) {
      iterator = new CollectLabelIterator(this.stateData);
    } else if (data[Moderation]) {
      iterator = new CollectModerationIterator(this.stateData);
    } else if (data[Person]) {
      iterator = new CollectPersonIterator(this.stateData);
    } else if (data[Segment]) {
      iterator = new CollectSegmentIterator(this.stateData);
    } else if (data[Text]) {
      iterator = new CollectTextIterator(this.stateData);
    } else if (data[CustomLabel]) {
      iterator = new CollectCustomLabelIterator(this.stateData);
    } else {
      const message = `iterator for ${Object.keys(data).join(', ')} not supported`;
      console.error(
        'ERR:',
        'StateCollectResultsIterator.process:',
        message
      );
      throw M2CException(message);
    }

    return iterator.process();
  }
}

module.exports = StateCollectResultsIterator;
