// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseAnalysisIndexer = require('../shared/baseAnalysisIndexer');

const SUBCATEGORY = AnalysisTypes.Rekognition.CustomLabel;

class IndexCustomLabelIterator extends BaseAnalysisIndexer {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'IndexCustomLabelIterator';
  }

  parseMetadata(data) {
    const model = this.stateData.data[SUBCATEGORY].customLabelModels;
    const datasets = [];

    for (const [name, value] of Object.entries(data)) {
      const timecodes = [];
      for (const { begin, end } of value) {
        timecodes.push({ begin, end });
      }

      if (timecodes.length > 0) {
        datasets.push({ model, name, timecodes });
      }
    }

    return datasets;
  }
}

module.exports = IndexCustomLabelIterator;
