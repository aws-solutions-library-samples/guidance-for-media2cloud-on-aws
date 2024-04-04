// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
  CommonUtils,
  Indexer,
} = require('core-lib');

const INDEX_CONTENT = Indexer.getContentIndex();

class BaseStateIndexer {
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
    return 'BaseStateIndexer';
  }

  get stateData() {
    return this.$stateData;
  }

  get subCategory() {
    return this.$subCategory;
  }

  get dataKey() {
    return undefined;
  }

  async process() {
    const datasets = await this.downloadMetadata()
      .then((res) =>
        this.parseDataset(res));

    // update field in opensearch
    if (datasets && datasets.length > 0) {
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

  async downloadMetadata() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.dataKey;
    if (!bucket || !key) {
      return undefined;
    }

    return CommonUtils.download(bucket, key)
      .catch((e) => {
        console.error(
          'ERR:',
          'BaseStateIndexer.downloadMetadata:',
          'CommonUtils.download:',
          e.name,
          e.message,
          key
        );
        return undefined;
      });
  }

  parseDataset(datasets) {
    if (!datasets) {
      return undefined;
    }
    const parsed = JSON.parse(datasets);
    return parsed.map((x) => ({
      name: x.text.trim(),
      timecodes: [
        {
          begin: x.begin,
          end: x.end || x.begin,
        },
      ],
    }));
  }

  setCompleted() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = BaseStateIndexer;
