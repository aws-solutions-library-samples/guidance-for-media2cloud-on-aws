// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  GetCelebrityRecognitionCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Celeb;
const NAMED_KEY = 'Celebrities';

class CollectCelebIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      SortBy: 'TIMESTAMP',
    };
  }

  get [Symbol.toStringTag]() {
    return 'CollectCelebIterator';
  }

  getRunCommand(params) {
    return new GetCelebrityRecognitionCommand(params);
  }

  parseResults(dataset) {
    const minConfidence = this.minConfidence;
    return dataset[NAMED_KEY]
      .filter((x) =>
        x.Celebrity
        && x.Celebrity.Name
        && x.Celebrity.Confidence >= minConfidence);
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.Celebrity.Name)),
    ];
  }
}

module.exports = CollectCelebIterator;
