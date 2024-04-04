// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  DB,
  CommonUtils,
  Environment,
  StateData,
  IngestError,
} = require('core-lib');
const PDFLib = require('./pdfLib');

const DOCINFO = 'docinfo';
const CATEGORY = 'transcode';
const OUTPUT_TYPE_PROXY = 'proxy';

class StateRunDocInfo {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateRunDocInfo';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const src = this.stateData.input || {};
    const dest = src.destination || {};
    if (!dest.bucket || !dest.prefix) {
      throw new IngestError('missing destination');
    }
    if (this.stateData.data === undefined) {
      this.stateData.data = {};
    }
    const data = this.stateData.data;
    data.cursor = data.cursor || 0;
    data.numPages = data.numPages || 0;
    do {
      const t0 = new Date();
      const document = await PDFLib.parseDocument(src.bucket, src.key);
      data.numPages = document.numPages;
      data.fingerprint = document.fingerprint;
      await this.processPage(document, data.cursor++);
      /* make sure we allocate enough time for the next iteration */
      const remained = this.stateData.getRemainingTime();
      const consumed = new Date() - t0;
      console.log(`COMPLETED: Page #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);
      if (this.stateData.quitNow() || (remained - (consumed * 1.2) <= 0)) {
        break;
      }
    } while (data.cursor < data.numPages);
    return (data.cursor >= data.numPages)
      ? this.setCompleted()
      : this.setProgress(Math.round((data.cursor / data.numPages) * 100));
  }

  async processPage(document, idx) {
    const pageNo = idx + 1;
    const page = await PDFLib.toPNG(document, pageNo);
    const dest = this.stateData.input.destination;
    const bucket = dest.bucket;
    const prefix = this.makeOutputPrefix(dest.prefix, OUTPUT_TYPE_PROXY);
    const name = StateRunDocInfo.makePNGFileName(idx);
    return CommonUtils.uploadFile(bucket, prefix, name, page.buffer);
  }

  async setCompleted() {
    const dest = this.stateData.input.destination;
    const output = this.makeOutputPrefix(dest.prefix);
    const data = this.stateData.data;
    const docinfo = {
      [DOCINFO]: {
        fingerprint: data.fingerprint,
        numPages: data.numPages,
      },
    };
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.update(this.stateData.uuid, undefined, docinfo, false);
    this.stateData.data = undefined;
    this.stateData.data = {
      ...docinfo,
      [CATEGORY]: {
        output,
      },
    };
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async setProgress(pencentage) {
    this.stateData.setProgress(pencentage);
    return this.stateData.toJSON();
  }

  makeOutputPrefix(prefix, keyword = '') {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(prefix, CATEGORY, keyword, '/');
  }

  static makePNGFileName(idx) {
    return `${String(idx).padStart(8, '0')}.png`;
  }
}

module.exports = StateRunDocInfo;
