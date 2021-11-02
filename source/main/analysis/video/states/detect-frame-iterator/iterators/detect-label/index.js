// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Label;
const NAMED_KEY = 'Labels';

class DetectLabelIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      MinConfidence: stateData.data[SUBCATEGORY].minConfidence,
    };
  }

  get [Symbol.toStringTag]() {
    return 'DetectLabelIterator';
  }

  async detectFrame(bucket, key, frameNo, timestamp) {
    const fn = this.rekog.detectLabels.bind(this.rekog);
    const params = this.makeParams(bucket, key, this.paramOptions);
    return this.detectFn(fn, params)
      .then(result =>
        this.parseLabelResult(result, frameNo, timestamp));
  }

  parseLabelResult(data, frameNo, timestamp) {
    return (!data || !data.Labels || !data.Labels.length)
      ? undefined
      : data.Labels.map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        Label: x,
      }));
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.map(x =>
      (x.Label || {}).Name).filter(x => x);
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

module.exports = DetectLabelIterator;
