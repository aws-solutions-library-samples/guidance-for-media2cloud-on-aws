// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Moderation;
const NAMED_KEY = 'ModerationLabels';

class DetectModerationIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      MinConfidence: stateData.data[SUBCATEGORY].minConfidence,
    };
  }

  get [Symbol.toStringTag]() {
    return 'DetectModerationIterator';
  }

  async detectFrame(bucket, key, frameNo, timestamp) {
    const fn = this.rekog.detectModerationLabels.bind(this.rekog);
    const params = this.makeParams(bucket, key, this.paramOptions);
    return this.detectFn(fn, params)
      .then(result =>
        this.parseModerationResult(result, frameNo, timestamp));
  }

  parseModerationResult(data, frameNo, timestamp) {
    return (!data || !data.ModerationLabels || !data.ModerationLabels.length)
      ? undefined
      : data.ModerationLabels.map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        ModerationLabel: x,
      }));
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.map(x =>
      (x.ModerationLabel || {}).ParentName).filter(x => x);
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

module.exports = DetectModerationIterator;
