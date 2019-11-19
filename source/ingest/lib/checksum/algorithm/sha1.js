/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const {
  ChecksumError,
  CommonUtils,
} = require('m2c-core-lib');

const {
  Rusha,
} = require('fixity-lib');

const {
  BaseLib,
} = require('./base');

/**
 * @class SHA1Lib
 * @description SHA1 checksum implementation
 */
class SHA1Lib extends BaseLib {
  constructor(stateData) {
    super('SHA1Lib', stateData);
    if ((this.stateData.input.checksum || {}).algorithm !== 'sha1') {
      throw new ChecksumError(`SHA1Lib not support algorithm, '${(this.stateData.input.checksum || {}).algorithm}'`);
    }
    this.algorithm = 'sha1';
  }

  static get Constants() {
    return {
      HeapSize: 128 * 1024, // 16 * 1024;
    };
  }

  /**
   * @override BaseLib compute()
   */
  async compute() {
    /* shouldn't be here */
    if (this.computed) {
      throw new ChecksumError();
    }

    const src = this.stateData.input.src || {};
    if (!src.bucket || !src.key) {
      throw new ChecksumError('missing src.bucket and key');
    }

    if (!this.fileSize) {
      const response = await CommonUtils.headObject(src.bucket, src.key);
      this.fileSize = Number.parseInt(response.ContentLength, 10);
    }

    this.bytesRead = 0;

    const responseData = await new Promise((resolve, reject) => {
      const rusha = new Rusha(SHA1Lib.Constants.HeapSize);
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
      const stream = CommonUtils.createReadStream(src.bucket, src.key, {
        Range: `bytes=${start}-${end}`,
      });

      stream.on('error', e =>
        reject(e));

      stream.on('data', async (data) => {
        this.bytesRead += data.length;
        rusha.append(data);
      });

      stream.on('end', async () => {
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
        resolve(this.stateData.toJSON());
      });
    });

    return responseData;
  }
}

module.exports = {
  SHA1Lib,
};
