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
  Retry,
} = require('core-lib');
const {
  CueLineQ,
} = require('./cueLine');

const PREV_STATE = 'transcribe';
const CATEGORY = 'comprehend';
const OUTPUT_JSON = 'output.json';
const OUTPUT_TEXTLISTS = 'textlists.txt';
const MIN_WORD_COUNTS = 2;
const SLICES_PER_PROCESS = 25;
const SUPPORTED_LANGUAGE_CODES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ar',
  'hi',
  'ja',
  'ko',
  'zh',
  'zh-TW',
];
const FILLER = '   ';

class BaseStateStartComprehend {
  constructor(stateData, detection = {}) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$t0 = new Date();
    this.$stateData = stateData;
    if (!detection.subCategory) {
      throw new AnalysisError('missing configuration');
    }
    if (typeof detection.func !== 'function') {
      throw new AnalysisError('missing configuration');
    }
    this.$detection = detection;
  }

  get [Symbol.toStringTag]() {
    return 'BaseStateStartComprehend';
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

  get func() {
    return this.$detection.func;
  }

  get paramOptions() {
    return this.$detection.paramOptions;
  }

  async process() {
    if (!this.checkCriteria()) {
      return this.dataLessThenThreshold();
    }

    const bucket = this.stateData.input.destination.bucket;

    /* download cuelines */
    const cuelines = await this.downloadCuelineResult();

    /* batch process */
    const textLists = [];
    const promises = [];
    const languageCode = this.getComprehendLanguageCode();
    while (cuelines.length) {
      const textList = [];
      const slices = cuelines.splice(0, SLICES_PER_PROCESS);
      while (slices.length) {
        const queue = CueLineQ.createFromJson(slices.shift());
        if (queue.wordCounts > MIN_WORD_COUNTS) {
          textList.push(queue.reduceAll().content);
        } else {
          /* filler to keep the line indices aliged */
          textList.push(FILLER);
        }
      }
      promises.push(this.startDetection({
        ...this.paramOptions,
        LanguageCode: languageCode,
        TextList: textList,
      }));
      textLists.push(textList);
    }
    /* parse job results */
    let responses = await Promise.all(promises);
    responses = this.parseJobResults(responses);

    const prefix = this.makeOutputPrefix();
    /* upload json output */
    await CommonUtils.uploadFile(bucket, prefix, OUTPUT_JSON, responses);
    /* upload list of sliced text */
    await CommonUtils.uploadFile(bucket, prefix, OUTPUT_TEXTLISTS, textLists);

    return this.setJobCompleted(PATH.join(prefix, OUTPUT_JSON));
  }

  checkCriteria() {
    const prevState = this.stateData.data[PREV_STATE];
    const enabled = this.stateData.input.aiOptions[this.subCategory] === true;
    const languageCode = this.getComprehendLanguageCode();
    return enabled
      && languageCode
      && prevState.cuelines !== undefined
      && prevState.totalWordCounts > MIN_WORD_COUNTS;
  }

  getComprehendLanguageCode() {
    const prevState = this.stateData.data[PREV_STATE];
    if (prevState.languageCode === 'zh-TW') {
      return 'zh-TW';
    }
    const languageCode = prevState.languageCode.slice(0, 2);
    if (SUPPORTED_LANGUAGE_CODES.indexOf(languageCode) < 0) {
      return undefined;
    }
    return languageCode;
  }

  dataLessThenThreshold() {
    this.stateData.setNoData();
    return this.stateData.toJSON();
  }

  async startDetection(params) {
    return Retry.run(this.func, params);
  }

  parseJobResults(responses) {
    throw new AnalysisError('subclass to implement');
  }

  makeOutputPrefix() {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.destination.prefix,
      'raw',
      timestamp,
      CATEGORY,
      this.subCategory,
      '/'
    );
  }

  async downloadCuelineResult() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.data[PREV_STATE].cuelines;
    return CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data));
  }

  setJobCompleted(output) {
    const data = {
      ...(this.stateData.data[CATEGORY] || {})[this.subCategory],
      startTime: this.t0.getTime(),
      endTime: new Date().getTime(),
      output,
    };
    this.stateData.setData(CATEGORY, {
      [this.subCategory]: data,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = BaseStateStartComprehend;
