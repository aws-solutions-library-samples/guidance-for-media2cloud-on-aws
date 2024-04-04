// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  CommonUtils,
  AnalysisTypes,
  MapDataVersion,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.CustomLabel;
const CUSTOMLABEL_MODELS = 'customLabelModels';
const NAMED_KEY = 'CustomLabels';
const MAP_FILENAME = 'mapFile.json';

class CollectCustomLabelIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
  }

  get [Symbol.toStringTag]() {
    return 'CollectCustomLabelIterator';
  }

  async process() {
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const key = data.output;
    const parsed = PATH.parse(key);
    const prefix = parsed.dir;
    const name = parsed.base;

    const dataset = await CommonUtils.download(
      bucket,
      key
    ).then((res) =>
      JSON.parse(res))
      .catch((e) =>
        console.error(e));
    if (dataset && dataset[NAMED_KEY]) {
      const filtered = this.parseResults(dataset);
      dataset[NAMED_KEY] = filtered;

      const mapData = {
        version: MapDataVersion,
        file: name,
        data: this.getUniqueNames(filtered),
      };

      await Promise.all([
        this.updateFile(
          bucket,
          prefix,
          name,
          dataset
        ),
        this.updateFile(
          bucket,
          prefix,
          MAP_FILENAME,
          mapData
        ),
      ]);
    }

    return this.setCompleted();
  }

  async updateFile(
    bucket,
    prefix,
    name,
    data
  ) {
    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      data
    ).catch((e) =>
      console.error(e));
  }

  parseResults(dataset) {
    const minConfidence = this.minConfidence;
    return dataset[NAMED_KEY]
      .filter((x) =>
        x.CustomLabel
        && x.CustomLabel.Name);
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.CustomLabel.Name)),
    ];
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory];
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(super.makeRawDataPrefix(subCategory), data[CUSTOMLABEL_MODELS], '/');
  }
}

module.exports = CollectCustomLabelIterator;
