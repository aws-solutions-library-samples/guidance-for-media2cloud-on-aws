// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

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
    const fn = this.rekog.recognizeCelebrities.bind(this.rekog);
    const params = this.makeParams(bucket, key, this.paramOptions);
    return this.detectFn(fn, params)
      .then(result =>
        this.parseCelebResult(result, frameNo, timestamp));
  }

  parseCelebResult(data, frameNo, timestamp) {
    return (!data || !data.CelebrityFaces || !data.CelebrityFaces.length)
      ? undefined
      : data.CelebrityFaces.map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        Celebrity: {
          ...x,
          Confidence: x.MatchConfidence,
        },
      }));
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.map(x =>
      (x.Celebrity || {}).Name).filter(x => x);
    keys = [...new Set(keys)];
    while (keys.length) {
      const key = keys.shift();
      const unique = new Set(mapData[key]);
      unique.add(seqFile);
      mapData[key] = [...unique];
    }
    return mapData;
  }
}

module.exports = DetectCelebIterator;
