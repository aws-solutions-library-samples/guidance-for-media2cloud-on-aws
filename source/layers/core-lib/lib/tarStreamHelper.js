// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const TAR = require('tar-stream');
const ZLIB = require('zlib');
const {
  mxCommonUtils,
} = require('./mxCommonUtils');

class CommonUtils extends mxCommonUtils(class {}) {}

class TarStreamHelper {
  static async extract(bucket, key) {
    return new Promise((resolve, reject) => {
      if (!bucket || !key) {
        reject(new Error('missing bucket or key'));
        return;
      }
      const resultSets = {};
      const readStream = CommonUtils.createReadStream(bucket, key);
      const unzip = ZLIB.createGunzip();
      const extract = TAR.extract();

      extract.on('entry', function (header, stream, next) {
        const buffers = [];
        console.log(`extracting '${header.name}'...`);
        stream.on('data', (chunk) =>
          buffers.push(chunk));
        stream.on('end', () => {
          resultSets[header.name] = Buffer.concat(buffers);
          next();
        });
        stream.resume();
      });
      extract.on('finish', () =>
        resolve(resultSets));
      extract.on('error', e =>
        reject(e));

      readStream.pipe(unzip).pipe(extract);
    });
  }
}

module.exports = TarStreamHelper;
