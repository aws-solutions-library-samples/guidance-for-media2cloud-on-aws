// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  GetFaceDetectionCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Face;
const NAMED_KEY = 'Faces';

class CollectFaceIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
  }

  get [Symbol.toStringTag]() {
    return 'CollectFaceIterator';
  }

  getRunCommand(params) {
    return new GetFaceDetectionCommand(params);
  }

  parseResults(dataset) {
    const minConfidence = this.minConfidence;
    return dataset[NAMED_KEY]
      .filter((x) =>
        x.Face
        && x.Face.Gender
        && x.Face.Gender.Value
        && x.Face.Confidence >= minConfidence);
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.Face.Gender.Value)),
    ];
  }
}

module.exports = CollectFaceIterator;
