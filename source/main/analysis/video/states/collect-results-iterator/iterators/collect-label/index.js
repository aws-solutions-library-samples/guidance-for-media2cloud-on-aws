// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  GetLabelDetectionCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
  WhitelistLabels,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Label;
const NAMED_KEY = 'Labels';

class CollectLabelIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      SortBy: 'TIMESTAMP',
    };
  }

  get [Symbol.toStringTag]() {
    return 'CollectLabelIterator';
  }

  getRunCommand(params) {
    return new GetLabelDetectionCommand(params);
  }

  parseModelMetadata(dataset) {
    return {
      VideoMetadata: dataset.VideoMetadata,
      LabelModelVersion: dataset.LabelModelVersion,
    };
  }

  parseResults(dataset) {
    /* Uncomment it to whitelist labels
    const filtered = dataset[NAMED_KEY]
      .filter((x) =>
        WhitelistLabels[x.Label.Name] !== undefined);
    return filtered;
    */
    const minConfidence = this.minConfidence;
    return dataset[NAMED_KEY]
      .filter((x) =>
        x.Label.Name
        && x.Label.Confidence >= minConfidence);
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.Label.Name)),
    ];
  }
}

module.exports = CollectLabelIterator;
