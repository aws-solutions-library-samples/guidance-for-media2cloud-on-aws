// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
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
    AutoFaceIndexer,
  },
  M2CException,
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
const CreateComboTrackIterator = require('./iterators/create-combo-track');

const FRAME_SEGMENTATION = 'framesegmentation';

class StateCreateTrackIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
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

    let iterator;
    if (data[Label]) {
      iterator = new CreateLabelTrackIterator(this.stateData);
    } else if (data[Moderation]) {
      iterator = new CreateModerationTrackIterator(this.stateData);
    } else if (data[Text]) {
      iterator = new CreateTextTrackIterator(this.stateData);
    } else if (data[Person]) {
      iterator = new CreatePersonTrackIterator(this.stateData);
    } else if (data[CustomLabel]) {
      iterator = new CreateCustomLabelTrackIterator(this.stateData);
    // auto face indexer
    } else if (data[AutoFaceIndexer] && data[Celeb] && data[FaceMatch]) {
      iterator = new CreateComboTrackIterator(this.stateData);
    // with combo
    } else if (data[Face] && (data[Celeb] || data[FaceMatch])) {
      iterator = new CreateComboTrackIterator(this.stateData);
    // without combo
    } else if (data[Celeb]) {
      iterator = new CreateCelebTrackIterator(this.stateData);
    } else if (data[Face]) {
      iterator = new CreateFaceTrackIterator(this.stateData);
    } else if (data[FaceMatch]) {
      iterator = new CreateFaceMatchTrackIterator(this.stateData);
    } else if (data[Segment] && !data[FRAME_SEGMENTATION]) {
      iterator = new CreateSegmentTrackIterator(this.stateData);
    } else {
      const message = `iterator for ${Object.keys(data).join(', ')} not supported`;
      console.error(
        'ERR:',
        'StateCreateTrackIterator.process:',
        message
      );
      throw M2CException(message);
    }

    return iterator.process();
  }
}

module.exports = StateCreateTrackIterator;
