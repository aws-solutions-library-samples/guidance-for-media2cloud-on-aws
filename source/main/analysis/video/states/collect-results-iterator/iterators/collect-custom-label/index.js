// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const PATH = require('path');
const {
  CommonUtils,
  AnalysisTypes,
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
    if (data.numOutputs === 0) {
      return this.setCompleted();
    }
    data.cursor = 0;
    do {
      await this.processResults(data.cursor++);
    } while (data.cursor < data.numOutputs);
    /* create mapData file */
    const prefix = this.makeRawDataPrefix(this.subCategory);
    const name = MAP_FILENAME;
    await CommonUtils.uploadFile(data.bucket, prefix, name, this.mapData)
      .catch(e => console.error(e));
    return (data.cursor === data.numOutputs)
      ? this.setCompleted()
      : this.setProgress(Math.round((data.cursor / data.numOutputs) * 100));
  }

  async processResults(idx) {
    const data = this.stateData.data[this.subCategory];
    const prefix = this.makeRawDataPrefix(this.subCategory);
    const name = BaseCollectResultsIterator.makeSequenceFileName(idx);
    const dataset = await CommonUtils.download(data.bucket, PATH.join(prefix, name), false)
      .then(x => JSON.parse(x.Body.toString())[NAMED_KEY]);
    this.mapData = this.mapUniqueNameToSequenceFile(this.mapData || {}, dataset, name);
    return idx;
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory];
    return PATH.join(
      super.makeRawDataPrefix(subCategory),
      data[CUSTOMLABEL_MODELS],
      '/'
    );
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.map(x =>
      (x.CustomLabel || {}).Name).filter(x => x);
    keys = [...new Set(keys)];
    while (keys.length) {
      const key = keys.shift();
      const unique = new Set(mapData[key]);
      unique.add(seqFile);
      mapData[key] = [...unique];
    }
    return mapData;
  }
}

module.exports = CollectCustomLabelIterator;
