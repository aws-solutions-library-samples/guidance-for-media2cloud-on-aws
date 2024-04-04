// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  ComprehendClient,
} = require('@aws-sdk/client-comprehend');
const {
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
  xraysdkHelper,
  retryStrategyHelper,
} = require('core-lib');
const {
  StateData,
  CommonUtils,
  WebVttHelper,
  M2CException,
} = require('core-lib');

const SUBCATEGORY_TRANSCRIBE = 'transcribe';
const PREV_STATE = 'transcribe';
const CATEGORY = 'comprehend';
const OUTPUT_JSON = 'output.json';
const OUTPUT_MANIFEST = 'output.manifest';
const MIN_CHARACTERS = 3;
const DOCUMENTS_PER_BATCH = 25;
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

class BaseStateStartComprehend {
  constructor(stateData, detection = {}) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
    }

    if (!detection.subCategory) {
      throw new M2CException('missing configuration');
    }

    this.$t0 = new Date();
    this.$stateData = stateData;
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

  get paramOptions() {
    return this.$detection.paramOptions;
  }

  async process() {
    if (!this.checkCriteria()) {
      return this.dataLessThenThreshold();
    }

    /* download and parse transcription */
    const doc = await this.getTranscribeResults();

    if (!doc || doc.length === 0) {
      return this.dataLessThenThreshold();
    }

    const bucket = this.stateData.input.destination.bucket;
    const languageCode = this.getComprehendLanguageCode();
    const responses = [];
    const metadata = [];
    while (doc.length) {
      const documents = await this.prepareDocuments(doc);
      if (documents.length > 0) {
        const response = await this.batchProcess(documents, languageCode);
        if (!response) {
          continue;
        }
        responses.push(response);
        const duped = JSON.parse(JSON.stringify(response));
        const parsed = this.parseJobResults(duped, documents);
        if (parsed && parsed.length) {
          metadata.splice(metadata.length, 0, ...parsed);
        }
      }
    }
    /* ensure there is metadata */
    if (!metadata.length) {
      return this.dataLessThenThreshold();
    }
    /* upload comprehend results */
    const prefix = this.makeOutputPrefix();
    const manifest = responses.map((x) =>
      JSON.stringify(x)).join('\n');
    await CommonUtils.uploadFile(bucket, prefix, OUTPUT_MANIFEST, manifest);
    /* upload metadata */
    const metadataPrefix = this.makeMetadataPrefix();
    await CommonUtils.uploadFile(bucket, metadataPrefix, OUTPUT_JSON, metadata);
    return this.setJobCompleted({
      output: PATH.join(prefix, OUTPUT_MANIFEST),
      metadata: PATH.join(metadataPrefix, OUTPUT_JSON),
    });
  }

  async getTranscribeResults() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.data[SUBCATEGORY_TRANSCRIBE].vtt;

    if (!key) {
      return undefined;
    }

    return WebVttHelper.download(bucket, key)
      .then((res) =>
        WebVttHelper.cuesToMetadata((res || {}).cues))
      .catch((e) => {
        console.error(
          'ERR:',
          'BaseStateStartComprehend.getTranscribeResults:',
          'WebVttHelper.download:',
          e.name,
          e.message
        );
        return undefined;
      });
  }

  async prepareDocuments(datasets) {
    const documents = [];
    while (datasets.length) {
      const data = datasets.shift();
      if (Buffer.from(data.name) <= MIN_CHARACTERS) {
        continue;
      }
      documents.push(data);
      if (documents.length === DOCUMENTS_PER_BATCH) {
        return documents;
      }
    }
    return documents;
  }

  async batchProcess(batch, languageCode) {
    const textList = batch.map((x) =>
      x.name);
    return this.startDetection({
      ...this.paramOptions,
      LanguageCode: languageCode,
      TextList: textList,
    });
  }

  checkCriteria() {
    const enabled = this.stateData.input.aiOptions[this.subCategory] === true;
    const languageCode = this.getComprehendLanguageCode();
    return enabled && languageCode;
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
    throw new M2CException('subclass to implement startDetection');
  }

  parseJobResults(responses, reference) {
    throw new M2CException('subclass to implement');
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

  makeMetadataPrefix() {
    return PATH.join(
      this.stateData.input.destination.prefix,
      'metadata',
      this.subCategory,
      '/'
    );
  }

  setJobCompleted(output) {
    const data = {
      ...(this.stateData.data[CATEGORY] || {})[this.subCategory],
      startTime: this.t0.getTime(),
      endTime: new Date().getTime(),
      ...output,
    };
    this.stateData.setData(CATEGORY, {
      [this.subCategory]: data,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  static RunCommand(command) {
    const comprehendClient = xraysdkHelper(new ComprehendClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(10),
    }));

    return comprehendClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }
}

module.exports = BaseStateStartComprehend;
