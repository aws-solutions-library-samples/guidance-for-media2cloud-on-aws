/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
} = require('core-lib');
const {
  CueLineQ,
} = require('./cueLine');

const PREV_STATE = 'transcribe';
const CATEGORY = 'comprehend';
const OUTPUT_JSON = 'output.json';

class BaseStateCreateTrack {
  constructor(stateData, detection = {}) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$t0 = new Date();
    this.$stateData = stateData;
    if (!detection.subCategory) {
      throw new AnalysisError('missing configuration');
    }
    this.$detection = detection;
  }

  get [Symbol.toStringTag]() {
    return 'BaseStateCreateTrack';
  }

  get stateData() {
    return this.$stateData;
  }

  get t0() {
    return this.$t0;
  }

  get subCategory() {
    return this.$detection.subCategory;
  }

  async process() {
    const cuelineQ = await this.downloadCuelineResult();
    const resultSets = await this.downloadDetectionResult();

    const processed = [];
    while (resultSets.length) {
      const parsed = this.processBatch(cuelineQ.shift(), resultSets.shift());
      processed.splice(processed.length, 0, ...parsed);
    }
    const metadata = await this.uploadMetadataOutput(processed);

    return this.setTrackCompleted(metadata);
  }

  async downloadCuelineResult() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.data[PREV_STATE].cuelines;
    return CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data));
  }

  async downloadDetectionResult() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.data[CATEGORY][this.subCategory].output;
    return CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data));
  }

  processBatch(cueline, results) {
    const processed = [];
    const queue = CueLineQ.createFromJson(cueline);
    while (results.length) {
      let result = results.shift();
      let item0;
      let item9;
      /* find beginOffset */
      while (queue.length) {
        item0 = queue.pop();
        if (item0.beginOffsetWithinRange(result.BeginOffset)) {
          break;
        } else if (item0.beginOffsetOutOfRange(result.BeginOffset)) {
          /* put item back in queue, set result to 'skip' instead of throwing an exception */
          console.log(`beginOffset (${result.Text}) out of range, (${result.BeginOffset}) [${item0.beginOffset} / ${item0.endOffset}]`);
          queue.insert(0, item0);
          result = undefined;
          break;
        }
      }
      if (result === undefined) {
        continue;
      }
      /* find endOffset */
      if (item0.endOffsetWithinRange(result.EndOffset)) {
        item9 = item0;
      } else {
        while (queue.length) {
          item9 = queue.pop();
          if (item9.endOffsetWithinRange(result.EndOffset)) {
            break;
          } else if (item9.endOffsetOutOfRange(result.EndOffset)) {
            throw new AnalysisError(`endOffset (${result.Text}) out of range, (${result.EndOffset}) [${item9.beginOffset} / ${item9.endOffset}]`);
          }
        }
      }
      processed.push(this.convertMetadataOutput(result, item0.begin, item9.end));
    }
    return processed;
  }

  convertMetadataOutput(item, begin, end) {
    return {
      text: item.Text,
      type: item.Type,
      confidence: Number.parseFloat(Number(item.Score * 100).toFixed(2)),
      begin,
      end,
    };
  }

  async uploadMetadataOutput(data) {
    const bucket = this.stateData.input.destination.bucket;
    const prefix = this.makeMetadataPrefix();
    await CommonUtils.uploadFile(bucket, prefix, OUTPUT_JSON, data);
    return PATH.join(prefix, OUTPUT_JSON);
  }

  makeMetadataPrefix() {
    return PATH.join(
      this.stateData.input.destination.prefix,
      'metadata',
      this.subCategory,
      '/'
    );
  }

  setTrackCompleted(metadata) {
    const data = {
      ...(this.stateData.data[CATEGORY] || {})[this.subCategory],
      metadata,
    };
    this.stateData.setData(CATEGORY, {
      [this.subCategory]: data,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = BaseStateCreateTrack;
