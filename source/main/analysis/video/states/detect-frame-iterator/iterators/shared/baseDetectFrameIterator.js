/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
  Retry,
} = require('core-lib');

const CATEGORY = 'rekognition';
const FRAMECAPTURE_PREFIX = 'frame';
const MAX_DATASET_PER_FILE = 1000;
const MAP_FILENAME = 'mapFile.json';

class BaseDetectFrameIterator {
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
    this.$paramOptions = undefined;
    this.$dataset = [];
    this.$rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
  }

  get [Symbol.toStringTag]() {
    return 'BaseDetectFrameIterator';
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

  get paramOptions() {
    return this.$paramOptions;
  }

  set paramOptions(val) {
    this.$paramOptions = val;
  }

  get dataset() {
    return this.$dataset;
  }

  get rekog() {
    return this.$rekog;
  }

  /* derived class to implement */
  async detectFrame(bucket, key, frameNo, timestamp) {
    throw new AnalysisError('dervied class to implement detectFrame');
  }

  /* derived class to implement */
  mapUniqueNameToSequenceFile(mapFile, data, seqFile) {
    throw new AnalysisError('dervied class to implement mapUniqueNameToSequenceFile');
  }

  async process() {
    const data = this.stateData.data[this.subCategory];
    const numFrames = data.frameCapture.numFrames;
    this.dataset.length = 0;
    data.startTime = data.startTime || Date.now();
    while (data.cursor < numFrames) {
      const t0 = new Date();
      await this.processFrame(data.cursor++);
      await this.flushDataset();
      /* make sure we allocate enough time for the next iteration */
      const remained = this.stateData.getRemainingTime();
      const consumed = new Date() - t0;
      console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);
      if (this.stateData.quitNow() || (remained - (consumed * 1.2) <= 0)) {
        break;
      }
    }
    await this.flushDataset(true);
    return (data.cursor >= numFrames)
      ? this.setCompleted()
      : this.setProgress(Math.round((data.cursor / numFrames) * 100));
  }

  async processFrame(idx) {
    const data = this.stateData.data[this.subCategory];
    const frameCapture = data.frameCapture;
    const [
      frameNo,
      timestamp,
    ] = BaseDetectFrameIterator.computeFrameNumAndTimestamp(
      idx,
      data.framerate,
      frameCapture.numerator,
      frameCapture.denominator
    );
    const name = BaseDetectFrameIterator.makeFrameCaptureFileName(idx);
    const key = PATH.join(frameCapture.prefix, name);
    // console.log(`PROCESSING: [#${idx}]: ${name} (${frameNo} / ${timestamp})`);
    const dataset = await this.detectFrame(data.bucket, key, frameNo, timestamp);
    if (dataset) {
      this.dataset.splice(this.dataset.length, 0, ...dataset);
    }
    return dataset;
  }

  async detectFn(fn, params) {
    return Retry.run(fn, params)
      .catch(e => console.error(e));
  }

  async flushDataset(forced = false) {
    if (!(this.dataset.length >= MAX_DATASET_PER_FILE
      || (forced && this.dataset.length > 0))) {
      return undefined;
    }
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const prefix = this.makeRawDataPrefix(this.subCategory);
    const seqFile = BaseDetectFrameIterator.makeSequenceFileName(data.numOutputs++);
    return Promise.all([
      this.updateMapFile(bucket, prefix, seqFile, this.dataset),
      this.uploadFile(bucket, prefix, seqFile, this.dataset),
    ]).then(() =>
      this.dataset.length = 0);
  }

  async updateMapFile(bucket, prefix, seqFile, data) {
    const name = MAP_FILENAME;
    /* download and merge mapData */
    let mapData = await CommonUtils.download(bucket, PATH.join(prefix, name), false)
      .then(x => JSON.parse(x.Body.toString()))
      .catch(() => ({}));
    mapData = this.mapUniqueNameToSequenceFile(mapData, data, seqFile);
    return (mapData)
      ? CommonUtils.uploadFile(bucket, prefix, name, mapData)
        .catch(e => console.error(e))
      : undefined;
  }

  async uploadFile(bucket, prefix, seqFile, data) {
    return CommonUtils.uploadFile(bucket, prefix, seqFile, {
      [this.namedKey]: data,
    }).catch(e => console.error(e));
  }

  makeParams(bucket, key, options) {
    if ((!bucket || !key) && !((options || {}).Image || {}).Bytes) {
      throw new AnalysisError('bucket and key or Image.Bytes must be specified');
    }
    return {
      Image: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
      ...options,
    };
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
    const data = this.stateData.data[this.subCategory];
    data.endTime = Date.now();
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

  static makeFrameCaptureFileName(frameNo) {
    return `${FRAMECAPTURE_PREFIX}.${frameNo.toString().padStart(7, '0')}.jpg`;
  }

  static computeFrameNumAndTimestamp(idx, framerate, numerator, denominator) {
    const num = Math.round((idx * framerate * denominator) / numerator);
    return [
      num,
      Math.round((num / framerate) * 1000),
    ];
  }
}

module.exports = BaseDetectFrameIterator;
