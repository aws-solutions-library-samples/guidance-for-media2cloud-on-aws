// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseStateIndexer = require('../shared/baseStateIndexer');

const CATEGORY = 'comprehend';
const SUB_CATEGORY = AnalysisTypes.Comprehend.Sentiment;

class StateIndexSentimentResults extends BaseStateIndexer {
  constructor(stateData) {
    super(stateData, SUB_CATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'StateIndexSentimentResults';
  }

  get dataKey() {
    return ((this.stateData.data[CATEGORY] || {})[SUB_CATEGORY] || {}).metadata;
  }
}

module.exports = StateIndexSentimentResults;
