/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const AWS = require('aws-sdk');
const CRYPTO = require('crypto');

/**
 * @mixins mxCommonUtils
 * @description common utility class
 * @param {class} Base
 */
const mxCommonUtils = Base => class extends Base {
  /**
   * @function unsignedUrl
   * @description convert Bucket / Key to HTTP URL
   * @param {object} params
   */
  static unsignedUrl(Bucket, Key) {
    return `https://${Bucket}.s3.${AWS.config.region}.amazonaws.com/${Key}`;
  }

  /**
   * @function headObject
   * @description wrap s3.headObject to intercept error message
   * @param {string} Bucket
   * @param {string} Key
   */
  static async headObject(Bucket, Key) {
    try {
      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
      });

      const response = await s3.headObject({ Bucket, Key }).promise();

      return response;
    } catch (e) {
      throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
    }
  }

  /* eslint-disable no-await-in-loop */
  /**
   * @function listObjects
   * @param {string} Bucket
   * @param {string} Prefix
   */
  static async listObjects(Bucket, Prefix) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });


    let collection = [];
    const params = {
      Bucket,
      Prefix,
      MaxKeys: 100,
    };

    let quit = false;
    while (!quit) {
      const {
        IsTruncated,
        Contents,
        NextContinuationToken,
      } = await s3.listObjectsV2(params).promise();

      collection = collection.concat(Contents);

      if (IsTruncated && NextContinuationToken) {
        params.ContinuationToken = NextContinuationToken;
      } else {
        quit = true;
      }
    }

    return collection;
  }
  /* eslint-enable no-await-in-loop */

  /**
   * @function getSignedUrl
   * @description return a signed url, default to expire in 2 hrs
   * @param {object} params
   */
  static getSignedUrl(params) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const {
      Bucket,
      Key,
      Expires = 60 * 60 * 2,
    } = params;

    return s3.getSignedUrl('getObject', { Bucket, Key, Expires });
  }

  /**
   * @function uuid4
   * @description generate UUID4 string
   * @param {string} [str] - if not specified, randomly generates one
   */
  static uuid4(str = undefined) {
    const s = str || CRYPTO.randomBytes(16).toString('hex');

    const matched = s.match(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/);

    if (!matched) {
      throw new Error(`failed to generate UUID from '${str}'`);
    }

    matched.shift();

    return matched.join('-').toLowerCase();
  }

  /**
   * @function normalizeFileName
   * @description normalize the file name to S3-friendly filename
   * @param {string} name
   */
  static normalizeFileName(name) {
    return name.replace(/[^a-fA-F0-9\-_.]/g, '_');
  }

  /**
   * @function unescapeS3Character
   * @description convert '+' character back to space character
   * @param {string} key
   */
  static unescapeS3Character(key) {
    return key.replace(/\+/g, ' ');
  }

  /**
   * @function toMD5String
   * @description convert MD5 string from/to hex/base64
   * @param {string} md5 - md5 string
   * @param {string} [format] - output format
   */
  static toMD5String(md5, format = 'hex') {
    if (!md5) {
      return undefined;
    }
    const encoded = md5.match(/^[0-9a-fA-F]{32}$/) ? 'hex' : 'base64';

    return Buffer.from(md5, encoded).toString(format);
  }

  /**
   * @function download
   * @param {string} Bucket
   * @param {string} Key
   * @param {boolean} bodyOnly
   */
  static async download(Bucket, Key, bodyOnly = true) {
    try {
      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
      });

      const response = await s3.getObject({
        Bucket,
        Key,
      }).promise();

      return (bodyOnly) ? response.Body.toString() : response;
    } catch (e) {
      throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
    }
  }

  /**
   * @function upload
   * @param {object} params
   */
  static async upload(params) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const response = await s3.putObject(params).promise();

    return response;
  }

  /**
   * @function sanitizedKey
   * @description make sure to trim leading '/' character
   * @param {string} key
   */
  static sanitizedKey(key = '') {
    return ((key[0] === '/') ? key.slice(1) : key).trim();
  }

  /**
   * @function deleteObject
   * @description delete object if exists
   * @param {string} Bucket
   * @param {string} Key
   * @returns {boolean}
   */
  static async deleteObject(Bucket, Key) {
    try {
      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
      });

      await s3.headObject({ Bucket, Key }).promise();

      await s3.deleteObject({ Bucket, Key }).promise();

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * @function tagObject
   * @description put object tagging
   * @param {string} Bucket
   * @param {string} Key
   * @param {Array} TagSet
   */
  static async tagObject(Bucket, Key, TagSet) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const promise = await s3.putObjectTagging({
      Bucket,
      Key,
      Tagging: {
        TagSet,
      },
    }).promise();

    return promise;
  }

  /**
   * @function zeroMD5
   * @returns {string} zero padded MD5 string
   */
  static zeroMD5() {
    return new Array(32).fill('0').join('');
  }

  /**
   * @function zeroAccountId
   * @returns {string} zero padded account id
   */
  static zeroAccountId() {
    return new Array(12).fill('0').join('');
  }

  /**
   * @function zeroUUID
   * @returns {string} zero padded UUID string
   */
  static zeroUUID() {
    const uuid = new Array(36).fill('0');

    /* eslint-disable no-multi-assign */
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    /* eslint-enable no-multi-assign */

    return uuid.join('');
  }

  /**
   * This callback is to implement custom sanitizer logic, as part of mxUtils mixins.
   * @callback mxUtils~sanitizerCallback
   * @param {string} key - object key
   * @param {*} value - object value
   * @param {object} obj - original object
   */
  /**
   * @function sanitizeJson
   * @param {object} data - json data
   * @param {mxUtils~sanitizerCallback} [callback] - callback to custom sanitize routine.
   */
  static sanitizeJson(data, callback) {
    /* eslint-disable no-param-reassign */
    /**
     * @function escapeFn
     * @description default sanitizer to escape '<', '>' characters to avoid xss attack
     * @param {string} k - object key
     * @param {any} v - object value
     * @param {object} obj - original object
     */
    function escapeFn(k, v, obj) {
      if (typeof v === 'string') {
        obj[k] = obj[k].replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    }
    /* eslint-enable no-param-reassign */

    /**
     * @function sanitizer
     * @description the actual recursive sanitizer function
     * @param {object} obj - object to be sanitized
     * @param {function} [cb] - callback function
     */
    function sanitizer(obj, cb) {
      Object.keys(obj).forEach((k) => {
        if (obj[k] !== null && obj[k] !== undefined && typeof obj[k] === 'object') {
          sanitizer(obj[k], cb);
        } else {
          cb.apply(this, [k, obj[k], obj]);
        }
      });
    }

    /* make a copy before we modify the content */
    const duped = JSON.parse(JSON.stringify(data));

    sanitizer(duped, callback || escapeFn);

    return duped;
  }
};

/**
 * @mixins mxNeat
 * @description provide a next function to remove empty key
 * @param {class} Base
 */
const mxNeat = Base => class extends Base {
  /**
   * @static
   * @function neat - empty properties that are undefined or null
   * @param {object} o - object
   */
  static neat(o) {
    const json = Object.assign({}, o);
    Object.keys(json).forEach((x) => {
      if (json[x] === undefined || json[x] === null) {
        delete json[x];
      }
    });

    return Object.keys(json).length === 0 ? undefined : json;
  }
};

module.exports = {
  mxCommonUtils,
  mxNeat,
};
