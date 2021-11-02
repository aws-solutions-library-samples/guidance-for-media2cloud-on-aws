// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

import S3Utils from '../s3utils.js';
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
    const results = await this.loadJsonResults();
    this.pages = (await Promise.all((results || []).map(x =>
      this.loadPageImage(x))))
      .filter(x => x);
    return this.pages;
  }

  async loadJsonResults() {
    const textract = this.getTextractResults();
    if (!textract || !textract.output || !textract.numOutputs) {
      return undefined;
    }
    const bucket = this.getProxyBucket();
    let promises = [];
    for (let i = 0; i < textract.numOutputs; i++) {
      const name = this.makeSequnceFileName(i);
      promises.push(S3Utils.getObject(bucket, `${textract.output}${name}`)
        .then(data =>
          JSON.parse(data.Body.toString()).Documents)
        .catch(e => console.error(e)));
    }
    promises = await Promise.all(promises);
    return promises.filter(x => x)
      .reduce((a0, c0) => a0.concat(c0), []);
  }

  async loadPageImage(data) {
    const bucket = this.getProxyBucket();
    return this.getNamedImageUrl(bucket, data.FileName)
      .then(x => ({
        ...x,
        data,
      }))
      .catch(e => console.error(e));
  }

  makeSequnceFileName(idx) {
    return `${String(idx).padStart(8, '0')}.json`;
  }
}
