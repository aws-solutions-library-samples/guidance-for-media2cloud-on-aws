// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
      try {
        /* property name such as 'constructor' will throw error */
        const unique = new Set(mapData[key]);
        unique.add(seqFile);
        mapData[key] = [...unique];
      } catch (e) {
        console.log('[ERR]: mapUniqueNameToSequenceFile: invalid text:', key, e.message);
      }
    }
    return mapData;
  }
}

module.exports = CollectTextIterator;
