// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  RecognizeCelebritiesCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Celeb;
const NAMED_KEY = 'Celebrities';

class DetectCelebIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
  }

  get [Symbol.toStringTag]() {
    return 'DetectCelebIterator';
  }

  async detectFrame(bucket, key, frameNo, timestamp) {
    const params = this.makeParams(bucket, key, this.paramOptions);
    const command = new RecognizeCelebritiesCommand(params);

    return this.detectFn(command)
      .then((res) =>
        this.parseCelebResult(res, frameNo, timestamp));
  }

  parseCelebResult(data, frameNo, timestamp) {
    if (!data || !data.CelebrityFaces || !data.CelebrityFaces.length) {
      return undefined;
    }

    const minConfidence = this.minConfidence;
    const filtered = data.CelebrityFaces
      .filter((x) =>
        x.MatchConfidence >= minConfidence);
    if (!filtered.length) {
      return undefined;
    }

    return filtered
      .map((x) => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        Celebrity: {
          ...x,
          Confidence: x.MatchConfidence,
        },
      }));
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.Celebrity.Name)),
    ];
  }
}

module.exports = DetectCelebIterator;
