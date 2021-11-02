// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  AnalysisTypes,
  Environment,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;
const NAMED_KEY = 'TextDetections';

class CollectTextIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    this.$func = rekog.getTextDetection.bind(rekog);
  }

  get [Symbol.toStringTag]() {
    return 'CollectTextIterator';
  }

  checkCriteria(text) {
    return (!Number.isNaN(Number(text))
      || (text && /[a-zA-Z0-9]{3,}/.test(text)))
      ? text
      : undefined;
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data
      .filter((x) =>
        (x.TextDetection || {}).Type === 'LINE')
      .map((x) =>
        this.checkCriteria((x.TextDetection || {}).DetectedText))
      .filter((x) => x);
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

module.exports = CollectTextIterator;
