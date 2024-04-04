// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
  CommonUtils,
  Indexer,
} = require('core-lib');

const INDEX_CONTENT = Indexer.getContentIndex();

class BaseAnalysisIndexer {
  constructor(stateData, subCategory) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    if (!subCategory) {
      throw new AnalysisError('subCategory not specified');
    }
    this.$stateData = stateData;
    this.$subCategory = subCategory;
  }

  get [Symbol.toStringTag]() {
    return 'BaseAnalysisIndexer';
  }

  get stateData() {
    return this.$stateData;
  }

  get subCategory() {
    return this.$subCategory;
  }

  async process() {
    const uuid = this.stateData.uuid;
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const path = data.metadata;
    if (!path) {
      return this.setCompleted();
    }

    const datasets = await CommonUtils.download(
      bucket,
      path
    ).then((res) =>
      this.parseMetadata(
        JSON.parse(res)
      ))
      .catch(() =>
        undefined);

    if (datasets !== undefined && datasets.length > 0) {
      const indexer = new Indexer();
      await indexer.update(
        INDEX_CONTENT,
        this.stateData.uuid,
        {
          [this.subCategory]: datasets,
        }
      );
    }

    return this.setCompleted();
  }

  parseMetadata(data) {
    return Object.keys(data)
      .map((name) => ({
        name,
        timecodes: data[name]
          .map((x) => ({
            begin: x.begin,
            end: x.end,
          })),
      }))
      .filter((x) =>
        x.timecodes.length > 0);
  }

  setCompleted() {
    delete this.stateData.data[this.subCategory].bucket;
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = BaseAnalysisIndexer;
