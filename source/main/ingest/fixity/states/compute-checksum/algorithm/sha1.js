// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ChecksumError,
  CommonUtils,
} = require('core-lib');
const {
  Rusha,
} = require('fixity-lib');
const BaseLib = require('./base');

const HEAP_SIZE = 128 * 1024; // 128KB // 16 * 1024;

class SHA1Lib extends BaseLib {
  constructor(stateData) {
    super('SHA1Lib', stateData);
    if ((this.stateData.data.checksum || {}).algorithm !== 'sha1') {
      throw new ChecksumError(`SHA1Lib not support algorithm, '${(this.stateData.data.checksum || {}).algorithm}'`);
    }
    this.algorithm = 'sha1';
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
      this.fileSize = Number.parseInt(response.ContentLength, 10);
    }

    this.bytesRead = 0;

    const rusha = new Rusha(HEAP_SIZE);
    rusha.resetState();

    if (this.intermediateHash) {
      const buf = Buffer.from(this.intermediateHash.heap, 'base64');
      const state = {
        offset: this.intermediateHash.offset,
        /* convert Base64 Buffer back to ArrayBuffer */
        heap: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
      rusha.setState(state);
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
      rusha.append(chunk);
    }

    if ((this.byteStart + this.bytesRead) >= this.fileSize) {
      this.computed = rusha.end();
      this.setChecksumCompleted();
    } else {
      const state = rusha.getState();
      this.intermediateHash = {
        offset: state.offset,
        /* convert ArrayBuffer to Base64 Buffer string */
        heap: Buffer.from(state.heap).toString('base64'),
      };
      this.setChecksumInProgress();
    }

    return this.stateData.toJSON();
  }
}

module.exports = SHA1Lib;
