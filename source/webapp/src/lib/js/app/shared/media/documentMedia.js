// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetS3Utils,
} from '../s3utils.js';
import BaseMedia from './baseMedia.js';

const DEFAULT_IMAGE = './images/document.png';

export default class DocumentMedia extends BaseMedia {
  constructor(data) {
    super(data);
    this.$pages = [];
  }

  get fingerprint() {
    return (this.docinfo || {}).fingerprint;
  }

  get numPages() {
    return (this.docinfo || {}).numPages;
  }

  get defaultImage() {
    return DEFAULT_IMAGE;
  }

  get pages() {
    return this.$pages;
  }

  set pages(val) {
    this.$pages = val;
  }

  async loadPages() {
    return this.loadJsonResults()
      .then((res) => {
        this.pages = res;
        return this.pages;
      });
  }

  async loadJsonResults() {
    const textract = this.getTextractResults();
    if (!textract || !textract.output) {
      return undefined;
    }

    const bucket = this.getProxyBucket();

    if (/json$/.test(textract.output)) {
      return this.loadSingleJsonResults(
        bucket,
        textract.output
      );
    }

    const s3utils = GetS3Utils();

    let promises = [];
    for (let i = 0; i < textract.numOutputs; i++) {
      const name = this.makeSequnceFileName(i);
      const key = `${textract.output}${name}`;

      promises.push(s3utils.getObject(
        bucket,
        key
      ).catch((e) => {
        console.error(
          'ERR:',
          `fail to get textract result (page #${i})`,
          name,
          e.message
        );
        return undefined;
      }));
    }

    /* await for the send command */
    promises = await Promise.all(promises);

    /* await for transform to string */
    promises = await Promise.all(promises
      .filter((x) =>
        x !== undefined)
      .map((x) =>
        x.Body.transformToString()
          .then((res) =>
            JSON.parse(res).Documents)));

    return promises
      .reduce((a0, c0) =>
        a0.concat(c0), [])
      .map((data) => ({
        name: this.getBasename(data.FileName),
        data,
      }));
  }

  makeSequnceFileName(idx) {
    return `${String(idx).padStart(8, '0')}.json`;
  }

  async loadSingleJsonResults(
    bucket,
    output
  ) {
    const s3utils = GetS3Utils();
    let pages = await s3utils.getObject(
      bucket,
      output
    ).catch((e) => {
      console.error(
        'ERR:',
        'loadSingleJsonResults:',
        'fail to get textract result',
        e
      );
      return undefined;
    });

    if (pages === undefined) {
      return undefined;
    }

    pages = await pages.Body.transformToString()
      .then((res) =>
        JSON.parse(res).Documents);

    pages = pages
      .map((data) => ({
        name: this.getBasename(data.FileName),
        data,
      }));

    return pages;
  }
}
