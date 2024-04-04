// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const TAR = require('tar-stream');
const ZLIB = require('zlib');
const CommonUtils = require('./commonUtils');
const {
  M2CException,
} = require('./error');

class TarStreamHelper {
  static async extract(bucket, key) {
    if (!bucket || !key) {
      throw new M2CException('missing bucket or key');
    }

    const readStream = await CommonUtils.createReadStream(
      bucket,
      key
    );

    return new Promise((resolve, reject) => {
      const unzip = ZLIB.createGunzip();
      const extract = TAR.extract();

      const resultSets = {};

      extract.on('entry', function (header, stream, next) {
        const buffers = [];
        console.log(`extracting '${header.name}'...`);

        stream.on('data', (chunk) => {
          buffers.push(chunk);
        });

        stream.on('end', () => {
          resultSets[header.name] = Buffer.concat(buffers);
          next();
        });

        stream.resume();
      });

      extract.on('finish', () => {
        resolve(resultSets);
      });

      extract.on('error', e => {
        reject(e);
      });

      readStream
        .pipe(unzip)
        .pipe(extract);
    });
  }
}

module.exports = TarStreamHelper;
