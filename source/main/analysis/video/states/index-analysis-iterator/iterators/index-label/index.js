// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseAnalysisIndexer = require('../shared/baseAnalysisIndexer');

const SUBCATEGORY = AnalysisTypes.Rekognition.Label;

class IndexLabelMatchIterator extends BaseAnalysisIndexer {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'IndexLabelMatchIterator';
  }
}

module.exports = IndexLabelMatchIterator;
