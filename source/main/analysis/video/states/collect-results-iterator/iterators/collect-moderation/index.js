// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  GetContentModerationCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Moderation;
const NAMED_KEY = 'ModerationLabels';

class CollectModerationIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      SortBy: 'TIMESTAMP',
    };
  }

  get [Symbol.toStringTag]() {
    return 'CollectModerationIterator';
  }

  getRunCommand(params) {
    return new GetContentModerationCommand(params);
  }

  parseModelMetadata(dataset) {
    return {
      VideoMetadata: dataset.VideoMetadata,
      ModerationModelVersion: dataset.ModerationModelVersion,
    };
  }

  parseResults(dataset) {
    const minConfidence = this.minConfidence;
    return dataset[NAMED_KEY]
      .filter((x) =>
        x.ModerationLabel
        && x.ModerationLabel.Confidence >= minConfidence
        && (x.ModerationLabel.Name || x.ModerationLabel.ParentName));
  }

  getUniqueNames(dataset) {
    const unique = dataset
      .map((x) => ([
        x.ModerationLabel.ParentName,
        x.ModerationLabel.Name,
      ]))
      .flat(1)
      .filter((x) =>
        x);
    return [
      ...new Set(unique),
    ];
  }
}

module.exports = CollectModerationIterator;
