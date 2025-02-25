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
      Text,
    },
    AutoFaceIndexer,
  },
  M2CException,
} = require('core-lib');
const DetectCelebIterator = require('./iterators/detect-celeb');
const DetectFaceIterator = require('./iterators/detect-face');
const DetectFaceMatchIterator = require('./iterators/detect-face-match');
const DetectLabelIterator = require('./iterators/detect-label');
const DetectModerationIterator = require('./iterators/detect-moderation');
const DetectTextIterator = require('./iterators/detect-text');
// run celeb and facematch detection based on face results
const DetectIdentityComboIterator = require('./iterators/detect-identity-combo');
// run auto face indexer logic
const AutoFaceIndexerIterator = require('./iterators/auto-face-indexer');

class StateDetectFrameIterator {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
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
    if (data[Label]) {
      iterator = new DetectLabelIterator(this.stateData);
    } else if (data[Moderation]) {
      iterator = new DetectModerationIterator(this.stateData);
    } else if (data[Text]) {
      iterator = new DetectTextIterator(this.stateData);
    // auto face indexer
    } else if (data[AutoFaceIndexer] && data[FaceMatch]) {
      iterator = new AutoFaceIndexerIterator(this.stateData);
    // use combo detection
    } else if (data[Face] && (data[Celeb] || data[FaceMatch])) {
      iterator = new DetectIdentityComboIterator(this.stateData);
    // no combo detection
    } else if (data[Celeb]) {
      iterator = new DetectCelebIterator(this.stateData);
    } else if (data[Face]) {
      iterator = new DetectFaceIterator(this.stateData);
    } else if (data[FaceMatch]) {
      iterator = new DetectFaceMatchIterator(this.stateData);
    } else {
      const message = `iterator for ${Object.keys(data).join(', ')} not supported`;
      console.error(
        'ERR:',
        'StateDetectFrameIterator.process:',
        message
      );
      throw M2CException(message);
    }

    return iterator.process();
  }
}

module.exports = StateDetectFrameIterator;
