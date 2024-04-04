// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ChecksumError,
  CommonUtils,
} = require('core-lib');
const {
  Spark,
} = require('fixity-lib');
const BaseLib = require('./base');

class MD5Lib extends BaseLib {
  constructor(stateData) {
    super('MD5Lib', stateData);
    this.algorithm = 'md5';
  }

  async compute() {
    /* shouldn't be here */
    if (this.computed) {
      throw new ChecksumError();
    }

    const src = this.stateData.input || {};
    if (!src.bucket || !src.key) {
      throw new ChecksumError('missing src.bucket and key');
    }

    if (!this.fileSize) {
      const response = await CommonUtils.headObject(src.bucket, src.key);
      this.fileSize = Number(response.ContentLength);
    }

    this.bytesRead = 0;

    const spark = new Spark.ArrayBuffer();
    if (this.intermediateHash) {
      spark.setState(this.intermediateHash);
    }

    const [
      start,
      end,
    ] = this.calculateByteRange();

    const range = {
      Range: `bytes=${start}-${end}`,
    };

    const stream = await CommonUtils.createReadStream(
      src.bucket,
      src.key,
      range
    );

    for await (const chunk of stream) {
      this.bytesRead += chunk.length;
      spark.append(chunk);
    }

    if ((this.byteStart + this.bytesRead) >= this.fileSize) {
      this.computed = spark.end();
      this.setChecksumCompleted();
    } else {
      this.intermediateHash = spark.getState();
      this.setChecksumInProgress();
    }

    return this.stateData.toJSON();
  }
}

module.exports = MD5Lib;
