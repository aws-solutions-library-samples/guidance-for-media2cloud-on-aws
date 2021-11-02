// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

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

    const responseData = await new Promise((resolve, reject) => {
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

module.exports = SHA1Lib;
