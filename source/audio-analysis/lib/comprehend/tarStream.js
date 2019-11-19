/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-underscore-dangle */
const AWS = require('aws-sdk');
const TAR = require('tar');

const {
  Transform,
} = require('stream');

/**
 * @class XTransform
 * @description implements Transform stream
 */
class XTransform extends Transform {
  constructor(options) {
    super(options);
    this.$chunks = [];
  }

  _transform(chunk, encoding, cb) {
    this.$chunks.push(chunk);
    return cb();
  }

  collect() {
    return Buffer.concat(this.$chunks.slice(0));
  }
}

/**
 * @class TarStream
 * @description extract xxx.tar.gz into Buffer
 */
class TarStream {
  constructor(bucket, key) {
    this.$bucket = bucket;
    this.$key = key;
  }

  /**
   * @static
   * @function createReadStream
   * @description wrapper to create read stream object
   * @param {string} Bucket
   * @param {string} Key
   */
  createReadStream() {
    try {
      return (new AWS.S3({
        apiVersion: '2006-03-01',
        signatureVersion: 'v4',
      })).getObject({
        Bucket: this.bucket,
        Key: this.key,
      }).createReadStream();
    } catch (e) {
      throw new Error(`${e.statusCode} ${e.code} ${this.bucket}/${this.key}`);
    }
  }

  get bucket() {
    return this.$bucket;
  }

  get key() {
    return this.$key;
  }

  async extract(files) {
    return new Promise((resolve, reject) => {
      if (!files) {
        reject(new Error('missing extract entry'));
      }

      const list = Array.isArray(files) ? files : [files];
      const output = new XTransform();
      const stream = this.createReadStream();

      stream.on('error', e => reject(e));
      stream.pipe(TAR.x({
        transform: (entry) => {
          console.log(`reading ${entry.absolute}`);
          return output;
        },
      }, list)).on('end', () => resolve(output.collect()));
    });
  }
}

module.exports = {
  TarStream,
};
