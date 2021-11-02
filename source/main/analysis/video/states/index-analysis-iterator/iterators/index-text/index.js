// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseAnalysisIndexer = require('../shared/baseAnalysisIndexer');

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;

class IndexTextIterator extends BaseAnalysisIndexer {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'IndexTextIterator';
  }
}

module.exports = IndexTextIterator;
