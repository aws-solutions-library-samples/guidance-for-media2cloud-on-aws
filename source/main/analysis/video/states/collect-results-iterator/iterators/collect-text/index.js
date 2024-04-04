// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  GetTextDetectionCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;
const NAMED_KEY = 'TextDetections';

class CollectTextIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
  }

  get [Symbol.toStringTag]() {
    return 'CollectTextIterator';
  }

  getRunCommand(params) {
    return new GetTextDetectionCommand(params);
  }

  checkCriteria(text) {
    return (!Number.isNaN(Number(text))
      || (text && /[a-zA-Z0-9]{3,}/.test(text)))
      ? text
      : undefined;
  }

  parseModelMetadata(dataset) {
    return {
      VideoMetadata: dataset.VideoMetadata,
      TextModelVersion: dataset.TextModelVersion,
    };
  }

  parseResults(dataset) {
    const minConfidence = this.minConfidence;
    /* also filter out if DetectedText is not a number or is less than 3 characters */
    return dataset[NAMED_KEY]
      .filter((x) =>
        x.TextDetection.Type === 'LINE'
        && x.TextDetection.Confidence >= minConfidence
        && (
          !Number.isNaN(Number(x.TextDetection.DetectedText))
          || /[a-zA-Z0-9]{3,}/.test(x.TextDetection.DetectedText)
        ));
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.TextDetection.DetectedText)),
    ];
  }
}

module.exports = CollectTextIterator;
