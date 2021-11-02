// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();

const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
  Retry,
  Environment,
} = require('core-lib');

const ANALYSIS_TYPE = 'document';
const CATEGORY = 'textract';
const MAX_PAGES_PER_FILE = 10;
const TEXTLIST_JSON = 'textlist.json';
const NAMED_KEY = 'Documents';

class StateStartDocumentAnalysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
    this.$dataset = [];
    this.$textract = new AWS.Textract({
      apiVersion: '2018-06-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartDocumentAnalysis';
  }

  get stateData() {
    return this.$stateData;
  }

  get dataset() {
    return this.$dataset;
  }

  get textract() {
    return this.$textract;
  }

  async process() {
    const document = this.stateData.input.document || {};
    const bucket = this.stateData.input.destination.bucket;
    if (!bucket || !document.prefix || !document.numPages) {
      throw new AnalysisError('bucket, document.prefix, or document.numPages not specified');
    }
    if (this.stateData.data === undefined) {
      this.stateData.data = {};
    }
    const data = this.stateData.data;
    data.cursor = data.cursor || 0;
    data.numOutputs = data.numOutputs || 0;
    while (data.cursor < document.numPages) {
      const t0 = new Date();
      await this.processPage(data.cursor++);
      await this.flushDataset();
      /* make sure we allocate enough time for the next iteration */
      const remained = this.stateData.getRemainingTime();
      const consumed = new Date() - t0;
      console.log(`COMPLETED: Page #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);
      if (this.stateData.quitNow() || (remained - (consumed * 1.2) <= 0)) {
        break;
      }
    }
    await this.flushDataset(true);
    return (data.cursor >= document.numPages)
      ? this.setCompleted()
      : this.setProgress(Math.round((data.cursor / document.numPages) * 100));
  }

  async processPage(idx) {
    const bucket = this.stateData.input.destination.bucket;
    const prefix = this.stateData.input.document.prefix;
    const name = StateStartDocumentAnalysis.makePNGFileName(idx);
    const dataset = await this.analyzeDocument(bucket, PATH.join(prefix, name), idx);
    if (dataset) {
      this.dataset.push(dataset);
    }
    return dataset;
  }

  async flushDataset(forced = false) {
    if (this.dataset.length === 0
      || (!forced && this.dataset.length < MAX_PAGES_PER_FILE)) {
      return undefined;
    }
    const data = this.stateData.data;
    const bucket = this.stateData.input.destination.bucket;
    const prefix = this.makeRawDataPrefix();
    const seqFile = StateStartDocumentAnalysis.makeSequenceFileName(data.numOutputs++);
    return Promise.all([
      this.updateTextlist(bucket, prefix, TEXTLIST_JSON, this.dataset),
      CommonUtils.uploadFile(bucket, prefix, seqFile, {
        [NAMED_KEY]: this.dataset,
      }),
    ]).then(() =>
      this.dataset.length = 0);
  }

  async analyzeDocument(bucket, key, idx) {
    const params = {
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
      FeatureTypes: [
        'TABLES',
        'FORMS',
      ],
    };
    const fn = this.textract.analyzeDocument.bind(this.textract);
    return Retry.run(fn, params)
      .then(data => ({
        PageNum: idx,
        FileName: key,
        Blocks: data.Blocks,
      }))
      .catch(e => console.error(e));
  }

  async updateTextlist(bucket, prefix, name, dataset) {
    const key = PATH.join(prefix, name);
    const mapData = await CommonUtils.download(bucket, key, false)
      .then(x => JSON.parse(x.Body.toString()))
      .catch(() => ([]));
    mapData.splice(mapData.length, 0, ...this.parseTextlist(dataset));
    return (mapData.length > 0)
      ? CommonUtils.uploadFile(bucket, prefix, name, mapData)
        .catch(e => console.error(e))
      : undefined;
  }

  parseTextlist(dataset) {
    return dataset.reduce((a0, c0) =>
      a0.concat(c0.Blocks
        .filter(x => x.BlockType === 'LINE')
        .map(x => x.Text)), [])
      .filter(x => x);
  }

  makeRawDataPrefix() {
    const input = this.stateData.input;
    const timestamp = CommonUtils.toISODateTime((input.request || {}).timestamp);
    return PATH.join(
      input.destination.prefix,
      'raw',
      timestamp,
      CATEGORY,
      '/'
    );
  }

  setCompleted() {
    const prefix = this.makeRawDataPrefix();
    const numOutputs = this.stateData.data.numOutputs;
    const stateExecution = this.stateData.event.stateExecution;
    this.stateData.data = undefined;
    this.stateData.data = {
      [ANALYSIS_TYPE]: {
        status: StateData.Statuses.Completed,
        executionArn: stateExecution.Id,
        startTime: new Date(stateExecution.StartTime).getTime(),
        endTime: Date.now(),
        [CATEGORY]: {
          output: prefix,
          numOutputs,
          textlist: TEXTLIST_JSON,
        },
      },
    };
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  setProgress(pencentage) {
    this.stateData.setProgress(pencentage);
    return this.stateData.toJSON();
  }

  static makePNGFileName(idx) {
    return `${String(idx).padStart(8, '0')}.png`;
  }

  static makeSequenceFileName(idx) {
    return `${String(idx).padStart(8, '0')}.json`;
  }
}

module.exports = StateStartDocumentAnalysis;
