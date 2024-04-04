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
const IndexCelebIterator = require('./iterators/index-celeb');
const IndexFaceIterator = require('./iterators/index-face');
const IndexFaceMatchIterator = require('./iterators/index-face-match');
const IndexLabelIterator = require('./iterators/index-label');
const IndexModerationIterator = require('./iterators/index-moderation');
const IndexPersonIterator = require('./iterators/index-person');
const IndexSegmentIterator = require('./iterators/index-segment');
const IndexTextIterator = require('./iterators/index-text');
const IndexCustomLabelIterator = require('./iterators/index-custom-label');
const IndexComboIterator = require('./iterators/index-combo');

const FRAME_SEGMENTATION = 'framesegmentation';

class StateIndexAnalysisIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
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
    const keys = Object.keys(data);

    let iterator;

    if (keys.includes(Celeb) && keys.includes(FaceMatch)) {
      iterator = new IndexComboIterator(this.stateData);
    } else if (keys.includes(Face) && (keys.includes(Celeb) || keys.includes(FaceMatch))) {
      iterator = new IndexComboIterator(this.stateData);
    } else if (keys.includes(Label)) {
      iterator = new IndexLabelIterator(this.stateData);
    } else if (keys.includes(Moderation)) {
      iterator = new IndexModerationIterator(this.stateData);
    } else if (keys.includes(Text)) {
      iterator = new IndexTextIterator(this.stateData);
    } else if (keys.includes(Person)) {
      iterator = new IndexPersonIterator(this.stateData);
    } else if (keys.includes(CustomLabel)) {
      iterator = new IndexCustomLabelIterator(this.stateData);
    } else if (keys.includes(Celeb)) {
      iterator = new IndexCelebIterator(this.stateData);
    } else if (keys.includes(FaceMatch)) {
      iterator = new IndexFaceMatchIterator(this.stateData);
    } else if (keys.includes(Face)) {
      iterator = new IndexFaceIterator(this.stateData);
    } else if (keys.includes(Segment) && !data[FRAME_SEGMENTATION]) {
      iterator = new IndexSegmentIterator(this.stateData);
    } else {
      const message = `iterator for ${keys.join(', ')} not supported`;
      console.error(
        'ERR:',
        'StateIndexAnalysisIterator.process:',
        message
      );
      throw M2CException(message);
    }

    return iterator.process();
  }
}

module.exports = StateIndexAnalysisIterator;
