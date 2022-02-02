// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseStateIndexer = require('../shared/baseStateIndexer');

const CATEGORY = 'comprehend';
const SUB_CATEGORY = AnalysisTypes.Comprehend.CustomEntity;

class StateIndexCustomEntityResults extends BaseStateIndexer {
  constructor(stateData) {
    super(stateData, SUB_CATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'StateIndexCustomEntityResults';
  }

  get dataKey() {
    return ((this.stateData.data[CATEGORY] || {})[SUB_CATEGORY] || {}).metadata;
  }
}

module.exports = StateIndexCustomEntityResults;
