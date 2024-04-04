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
const ImageProcess = require('./imageProcess');

const CATEGORY = 'transcode';
const OUTPUT_TYPE_PROXY = 'proxy';
const CATEGORY_IMAGEINFO = 'imageinfo';
const OUTPUT_JSON = `${CATEGORY_IMAGEINFO}.json`;

class StateRunImageInfo {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateRunImageInfo';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const promises = [];
    const src = this.stateData.input || {};
    const dest = src.destination || {};
    if (!dest.bucket || !dest.prefix) {
      throw new IngestError('missing destination');
    }
    /* extract EXIF from image */
    const imageProcessor = new ImageProcess(this.stateData);
    const imageinfo = await imageProcessor.getImageInfo();
    /* store images to transcode/proxy folder */
    const bucket = dest.bucket;
    const basename = PATH.parse(src.key).name;
    if (imageinfo.preview) {
      const prefix = this.makeOutputPrefix(dest.prefix, OUTPUT_TYPE_PROXY);
      const name = `${basename}.jpg`;
      promises.push(CommonUtils.uploadFile(bucket, prefix, name, imageinfo.preview));
    }
    if (imageinfo.thumbnail) {
      const prefix = this.makeOutputPrefix(dest.prefix, OUTPUT_TYPE_PROXY);
      const name = `${basename}_thumbnail.jpg`;
      promises.push(CommonUtils.uploadFile(bucket, prefix, name, imageinfo.thumbnail));
    }
    /* store EXIF to imageinfo folder */
    if (imageinfo.exif) {
      const prefix = PATH.join(dest.prefix, CATEGORY_IMAGEINFO, '/');
      const name = OUTPUT_JSON;
      promises.push(CommonUtils.uploadFile(bucket, prefix, name, imageinfo.exif));
      this.stateData.setData(CATEGORY_IMAGEINFO, {
        output: PATH.join(prefix, name),
      });
    }
    await Promise.all(promises);
    /* update database */
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.update(this.stateData.uuid, undefined, {
      imageinfo: (this.stateData.data[CATEGORY_IMAGEINFO] || {}).output,
    }, false);
    /* save state data */
    this.stateData.setData(CATEGORY, {
      output: this.makeOutputPrefix(dest.prefix),
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  makeOutputPrefix(prefix, keyword = '') {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(prefix, CATEGORY, keyword, '');
  }
}

module.exports = StateRunImageInfo;
