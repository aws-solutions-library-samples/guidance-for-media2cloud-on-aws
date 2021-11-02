// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
  Retry,
} = require('core-lib');

const CATEGORY = 'rekognition';
const RESULTS_PER_FILE = 10; // merge 10 detection results into one file
const MAP_FILENAME = 'mapFile.json';
const MAX_SAMPLING_RATE = 2000; // 2s max sampling rate

class BaseCollectResultsIterator {
  constructor(stateData, subCategory, namedKey) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    /* detection type such as label, celeb, and etc */
    if (!subCategory) {
      throw new AnalysisError('subCategory not specified');
    }
    /* JSON output file's root key */
    if (!namedKey) {
      throw new AnalysisError('namedKey not specified');
    }
    this.$stateData = stateData;
    this.$subCategory = subCategory;
    this.$namedKey = namedKey;
    this.$dataset = [];
    this.$mapData = undefined;
    this.$func = undefined;
    this.$paramOptions = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'BaseCollectResultsIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  get subCategory() {
    return this.$subCategory;
  }

  get namedKey() {
    return this.$namedKey;
  }

  get dataset() {
    return this.$dataset;
  }

  get mapData() {
    return this.$mapData;
  }

  set mapData(val) {
    this.$mapData = val;
  }

  get func() {
    return this.$func;
  }

  get paramOptions() {
    return this.$paramOptions;
  }

  /* derived class to implement */
  mapUniqueNameToSequenceFile(mapFile, data, seqFile) {
    throw new AnalysisError('dervied class to implement mapUniqueNameToSequenceFile');
  }

  async process() {
    const data = this.stateData.data[this.subCategory];
    if (!data.jobId) {
      throw new AnalysisError(`missing data.${this.subCategory}.jobId`);
    }
    if (typeof this.func !== 'function') {
      throw new AnalysisError('this.func not implement');
    }
    do {
      const t0 = new Date();
      await this.processResults(data.jobId);
      await this.flushDataset();
      /* make sure we allocate enough time for the next iteration */
      const remained = this.stateData.getRemainingTime();
      const consumed = new Date() - t0;
      console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);
      if (this.stateData.quitNow() || (remained - (consumed * 1.2) <= 0)) {
        break;
      }
    } while (data.nextToken);
    await this.flushDataset();

    return (!data.nextToken)
      ? this.setCompleted()
      : this.setProgress(data.numOutputs);
  }

  async processResults(jobId) {
    const data = this.stateData.data[this.subCategory];
    let batchIdx = 0;
    do {
      await this.getDetectionResults({
        ...this.paramOptions,
        JobId: jobId,
        NextToken: data.nextToken,
      }).then((dataset) => {
        data.nextToken = dataset.NextToken;
        return this.dataset.splice(this.dataset.length, 0, ...this.parseResults(dataset));
      });
    } while (data.nextToken && batchIdx++ < RESULTS_PER_FILE);
    if (!data.sampling) {
      data.sampling = BaseCollectResultsIterator.computeSampling(this.dataset);
    }
    return data.nextToken;
  }

  async getDetectionResults(params) {
    return Retry.run(this.func, params)
      .catch((e) => {
        e.message = `${CATEGORY}.${this.subCategory}.${params.JobId}: ${e.message}`;
        console.error(e);
        throw new AnalysisError(e);
      });
  }

  parseResults(dataset) {
    return dataset[this.namedKey];
  }

  async flushDataset() {
    if (!this.dataset.length) {
      return undefined;
    }
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const prefix = this.makeRawDataPrefix(this.subCategory);
    const seqFile = BaseCollectResultsIterator.makeSequenceFileName(data.numOutputs++);
    return Promise.all([
      this.updateMapFile(bucket, prefix, seqFile, this.dataset),
      this.uploadFile(bucket, prefix, seqFile, this.dataset),
    ]).then(() =>
      this.dataset.length = 0);
  }

  async updateMapFile(bucket, prefix, seqFile, data) {
    const name = MAP_FILENAME;
    /* download and merge mapData */
    if (!this.mapData) {
      this.mapData = await CommonUtils.download(bucket, PATH.join(prefix, name), false)
        .then(x => JSON.parse(x.Body.toString()))
        .catch(() => ({}));
    }
    this.mapData = this.mapUniqueNameToSequenceFile(this.mapData, data, seqFile);
    return (this.mapData)
      ? CommonUtils.uploadFile(bucket, prefix, name, this.mapData)
        .catch(e => console.error(e))
      : undefined;
  }

  async uploadFile(bucket, prefix, seqFile, data) {
    return CommonUtils.uploadFile(bucket, prefix, seqFile, {
      [this.namedKey]: data,
    }).catch(e => console.error(e));
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory];
    const timestamp = CommonUtils.toISODateTime(data.requestTime);
    return PATH.join(
      data.prefix,
      'raw',
      timestamp,
      CATEGORY,
      subCategory,
      '/'
    );
  }

  setCompleted() {
    this.stateData.data[this.subCategory].cursor = 0;
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  setProgress(pencentage) {
    this.stateData.setProgress(pencentage);
    return this.stateData.toJSON();
  }

  static makeSequenceFileName(idx) {
    return `${String(idx).padStart(8, '0')}.json`;
  }

  static computeSampling(dataset) {
    if (!dataset.length || dataset[0].Timestamp === undefined) {
      return undefined;
    }
    const timestamps = [...new Set(dataset.map(x => x.Timestamp))].sort((a, b) => a - b);
    const diffs = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      diffs.push(timestamps[i + 1] - timestamps[i]);
    }
    const max = Math.round(Math.max(...diffs));
    return Math.min(max, MAX_SAMPLING_RATE);
  }
}

module.exports = BaseCollectResultsIterator;
