// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
  CommonUtils,
  Indexer,
} = require('core-lib');

const TYPE_VIDEO = 'video';

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
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const prefix = data.metadata;
    if (!prefix) {
      return this.setCompleted();
    }

    let response;
    const datasets = [];
    do {
      response = await CommonUtils.listObjects(bucket, prefix, {
        ContinuationToken: (response || {}).NextContinuationToken,
        MaxKeys: 200,
      }).catch((e) =>
        console.error(`[ERR]: CommonUtils.listObjects: ${prefix} ${e.code} ${e.message}`));
      if (response && response.Contents) {
        const dataset = await Promise.all(response.Contents.map((x) =>
          this.downloadAndParseMetadata(bucket, x.Key)));
        datasets.splice(datasets.length, 0, ...dataset);
      }
    } while ((response || {}).NextContinuationToken);

    if (datasets.length > 0) {
      const uuid = this.stateData.uuid;
      const indexer = new Indexer();
      await indexer.indexDocument(this.subCategory, uuid, {
        type: TYPE_VIDEO,
        data: datasets,
      }).catch((e) =>
        console.error(`[ERR]: indexer.indexDocument: ${uuid}: ${this.subCategory}`, e));
    }
    return this.setCompleted();
  }

  async downloadAndParseMetadata(bucket, key) {
    const datasets = await CommonUtils.download(bucket, key, false)
      .then((res) =>
        JSON.parse(res.Body))
      .catch((e) =>
        console.error(`[ERR]: CommonUtils.download: ${key} ${e.code} ${e.message}`));
    if (!datasets || !datasets.length) {
      return undefined;
    }
    const name = this.parseIndexName(datasets[0]);
    const timecodes = datasets.map((x) => ({
      begin: x.begin,
      end: x.end,
    }));
    return {
      name,
      timecodes,
    };
  }

  parseIndexName(dataset) {
    return dataset.name.replace(/_/g, ' ');
  }

  setCompleted() {
    delete this.stateData.data[this.subCategory].bucket;
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = BaseAnalysisIndexer;
