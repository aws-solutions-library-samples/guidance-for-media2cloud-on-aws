// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes: {
    Rekognition: {
      Segment,
    },
  },
} = require('core-lib');
const BaseAnalysisIndexer = require('../shared/baseAnalysisIndexer');

class IndexSegmentIterator extends BaseAnalysisIndexer {
  constructor(stateData) {
    super(stateData, Segment);
  }

  get [Symbol.toStringTag]() {
    return 'IndexSegmentIterator';
  }
}

module.exports = IndexSegmentIterator;
