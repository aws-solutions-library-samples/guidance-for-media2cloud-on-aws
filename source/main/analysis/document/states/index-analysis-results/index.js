// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const PATH = require('path');
const {
  StateData,
  AnalysisTypes,
  AnalysisError,
  CommonUtils,
  Indexer,
} = require('core-lib');

const ANALYSIS_TYPE = 'document';
const CATEGORY = AnalysisTypes.Textract;

class StateIndexAnalysisResults {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateIndexAnalysisResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const bucket = this.stateData.input.destination.bucket;
    const data = this.stateData.data[ANALYSIS_TYPE][CATEGORY];
    await this.indexResults(bucket, data.output, data.numOutputs);
    return this.setCompleted();
  }

  async indexResults(bucket, prefix, numOutputs) {
    const datasets = [];
    for (let i = 0; i < numOutputs; i++) {
      const name = this.makeSequenceFileName(i);
      const data = await CommonUtils.download(bucket, PATH.join(prefix, name), false)
        .then((res) =>
          JSON.parse(res.Body));
      const dataset = data.Documents.map((page) =>
        this.parsePage(page));
      datasets.splice(datasets.length, 0, ...dataset.flat());
    }
    if (datasets && datasets.length > 0) {
      const uuid = this.stateData.uuid;
      const indexer = new Indexer();
      return indexer.indexDocument(CATEGORY, uuid, {
        type: ANALYSIS_TYPE,
        data: datasets,
      }).catch((e) =>
        console.error(`[ERR]: indexer.indexDocument: ${uuid}: ${CATEGORY}`, e));
    }
    return undefined;
  }

  parsePage(page) {
    const datasets = [];
    const pageNum = page.PageNum;
    while (page.Blocks.length) {
      const block = page.Blocks.shift();
      if (block.BlockType === 'LINE') {
        datasets.push({
          name: block.Text.trim(),
          page: pageNum,
        });
      }
    }
    return datasets;
  }

  makeSequenceFileName(idx) {
    return `${String(idx).padStart(8, '0')}.json`;
  }

  setCompleted() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateIndexAnalysisResults;
