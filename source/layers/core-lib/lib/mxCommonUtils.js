// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const URL = require('url');
const CRYPTO = require('crypto');
const MIME = require('mime');
const ZLIB = require('zlib');
const PATH = require('path');
const Environment = require('./environment');

const RAW_IMAGE_MIME_TYPES = {
  'image/x-adobe-dng': ['DNG'],
  'image/x-canon-cr2': ['CR2'],
  'image/x-canon-crw': ['CRW'],
  'image/x-epson-erf': ['ERF'],
  'image/x-fuji-raf': ['RAF'],
  'image/x-kodak-dcr': ['DCR'],
  'image/x-kodak-k25': ['K25'],
  'image/x-kodak-kdc': ['KDC'],
  'image/x-minolta-mrw': ['MRW'],
  'image/x-nikon-nef': ['NEF'],
  'image/x-olympus-orf': ['ORF'],
  'image/x-panasonic-raw': ['RAW'],
  'image/x-pentax-pef': ['PEF'],
  'image/x-sony-arw': ['ARW'],
  'image/x-sony-sr2': ['SR2'],
  'image/x-sony-srf': ['SRF'],
  'image/x-sigma-x3f': ['X3F'],
};

class X0 {
  /**
   * @static
   * @function isObject
   * @description test if obj is object type
   * @param {object} obj
   * @returns {boolean}
   */
  static isObject(obj) {
    return obj && typeof obj === 'object';
  }

  /**
   * @static
   * @function isPrimitive
   * @description test if object is primitive type
   * note: the logic also consider 'null' is primitive!
   * @param {object} obj
   * @returns {boolean}
   */
  static isPrimitive(obj) {
    switch (typeof obj) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
      case 'symbol':
        return true;
      default:
        break;
    }
    return (obj === null);
  }

  /**
   * @static
   * @function internalMerge
   * @description merge two objects recursively
   * @param {object} target
   * @param {object} source
   * @returns {object} merged object
   */
  static internalMerge(target, source) {
    if (!X0.isObject(target) || !X0.isObject(source)) {
      return source;
    }

    Object.keys(source).forEach(key => {
      const targetValue = target[key];
      const sourceValue = source[key];
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        target[key] = Array.from(new Set(targetValue.concat(sourceValue)))
          .filter(x => x !== undefined);
      } else if (X0.isObject(targetValue) && X0.isObject(sourceValue)) {
        target[key] = X0.internalMerge({
          ...targetValue,
        }, sourceValue);
      } else {
        target[key] = sourceValue;
      }
    });
    return target;
  }

  /**
   * @static
   * @function internalCleansing
   * @description remove empty key recursively
   * @param {object} obj
   * @param {object} [removeList]
   * @param {boolean} [removeList.array] - should remove empty array
   * @param {boolean} [removeList.object] - should remove empty object
   * @returns {object} clean object
   */
  static internalCleansing(obj, removeList = {}) {
    if (X0.isPrimitive(obj)) {
      return ((obj === null) || (typeof obj === 'string' && !obj.length))
        ? undefined
        : obj;
    }

    if ((removeList.array || removeList.object) && !Object.keys(obj).length) {
      return undefined;
    }

    const duped = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach((x) => {
      duped[x] = X0.internalCleansing(obj[x], removeList);
    });

    return Array.isArray(duped)
      ? duped.filter(x => x !== undefined)
      : duped;
  }

  static flatten(arr, depth = 1) {
    return (depth > 0)
      ? arr.reduce((acc, cur) =>
        acc.concat(Array.isArray(cur)
          ? X0.flatten(cur, depth - 1)
          : cur), [])
      : arr.slice();
  }
}

class M0 {
  /**
   * @function getMime
   * @param {string} file
   * @returns {string} mime type
   */
  static getMime(file) {
    MIME.define(RAW_IMAGE_MIME_TYPES, true);
    return MIME.getType(file) || 'application/octet-stream';
  }

  /**
   * @static
   * @function getExtensionByMime
   * @description get file extension by mime type
   * @param {string} mime - mime type
   */
  static getExtensionByMime(mime) {
    MIME.define({
      'image/jpeg': [
        'jpg',
      ],
    }, true);
    return MIME.getExtension(mime);
  }

  /**
   * @function parseMimeType
   * @param {string} mime - 'video/mp4', 'audio/mp4'
   */
  static parseMimeType(mime) {
    const [
      type,
      subtype,
    ] = (mime || '').split('/').filter(x => x).map(x => x.toLowerCase());

    // eslint-disable-next-line
    return (type === 'video' || type === 'audio' || type === 'image')
      ? type
      : (subtype === 'mxf' || subtype === 'gxf')
        ? 'video'
        : (subtype === 'pdf')
          ? 'document'
          : subtype;
  }
}

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
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    return s3.headObject({
      Bucket,
      Key,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }).promise().catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
    });
  }

  /**
   * @function listObjects
   * @param {string} Bucket
   * @param {string} Prefix
   */
  static async listObjects(Bucket, Prefix, options) {
    const prefix = PATH.join(Prefix, '/');
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    return s3.listObjectsV2({
      Bucket,
      Prefix: prefix,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
      ...options,
    }).promise();
  }

  /**
   * @function getSignedUrl
   * @description return a signed url, default to expire in 2 hrs
   * @param {object} params
   */
  static getSignedUrl(params) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    const {
      Bucket,
      Key,
      Expires = 60 * 60 * 2,
    } = params;

    return s3.getSignedUrl('getObject', {
      Bucket,
      Key,
      Expires,
    });
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
    return name.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  }

  /**
   * @function escapeS3Characters
   * @description convert space character to '+ character
   * @param {string} key
   */
  static escapeS3Characters(key) {
    return encodeURIComponent(key).replace(/%20/g, '+');
  }

  /**
   * @function unescapeS3Character
   * @description convert '+' character back to space uri-encoded character
   * @param {string} key
   */
  static unescapeS3Character(key) {
    return decodeURIComponent(key.replace(/\+/g, '%20'));
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
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    return s3.getObject({
      Bucket,
      Key,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }).promise().then(data =>
      ((bodyOnly)
        ? data.Body.toString()
        : data))
      .catch((e) => {
        throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
      });
  }

  /**
   * @function upload
   * @param {object} params
   */
  static async upload(params) {
    /* ensure header doesn't contain invalid character */
    const invalidCharacter = /[^\t\x20-\x7e\x80-\xff]/;
    const modified = [
      'ContentDisposition',
    ].reduce((acc, cur) => {
      if (!params[cur]) {
        return acc;
      }
      const valid = params[cur].split(';').map(x => x.trim()).filter(x =>
        !invalidCharacter.test(x));
      return Object.assign(acc, {
        [cur]: (valid.length) ? valid.join('; ').trim() : undefined,
      });
    }, params);

    return (new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    })).putObject({
      ...modified,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }).promise().catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${params.Bucket}/${params.Key}`);
    });
  }

  static async uploadFile(bucket, prefix, name, data) {
    const body = (typeof data === 'string' || data instanceof Buffer)
      ? data
      : JSON.stringify(data, null, 2);
    /* ensure header doesn't contain invalid character */
    const disposition = (/[^\t\x20-\x7e\x80-\xff]/.test(name))
      ? 'attachment'
      : `attachment; filename="${name}"`;

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    return s3.putObject({
      Bucket: bucket,
      Key: PATH.join(prefix, name),
      Body: body,
      ContentType: M0.getMime(name),
      ContentDisposition: disposition,
      ServerSideEncryption: 'AES256',
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }).promise().catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${bucket}/${prefix}/${name}`);
    });
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
   * @function sanitizedPath
   * @description strip off leading forward slash
   * @param {string} path
   */
  static sanitizedPath(path) {
    const {
      root,
      dir,
      base,
      ext,
      name,
    } = PATH.parse(path);

    return {
      root,
      dir: (dir[0] === '/') ? dir.slice(1) : dir,
      base,
      ext,
      name,
    };
  }

  /**
   * @function deleteObject
   * @description delete object if exists
   * @param {string} Bucket
   * @param {string} Key
   * @returns {boolean}
   */
  static async deleteObject(Bucket, Key) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    return s3.deleteObject({
      Bucket,
      Key,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }).promise()
      .then(() => true)
      .catch(() => false);
  }

  /**
   * @async
   * @function getTags
   * @description wrapper to S3.getObjectTagging api
   * @param {string} Bucket
   * @param {string} Key
   */
  static async getTags(Bucket, Key) {
    return (new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    })).getObjectTagging({
      Bucket,
      Key,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }).promise().catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
    });
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
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    const response = await s3.getObjectTagging({
      Bucket,
      Key,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }).promise().catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
    });

    /* #1: remove existing tags */
    TagSet.map(x => x.Key).forEach((tag) => {
      const idx = response.TagSet.findIndex(x => x.Key === tag);
      if (idx >= 0) {
        response.TagSet.splice(idx, 1);
      }
    });

    /* #2: merge tagset. If tagset > 10, don't update it */
    const tagSet = TagSet.concat(response.TagSet);
    return (tagSet.length > 10)
      ? undefined
      : s3.putObjectTagging({
        Bucket,
        Key,
        Tagging: {
          TagSet: tagSet,
        },
        ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
      }).promise().catch((e) => {
        throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
      });
  }

  /**
   * @static
   * @function createReadStream
   * @description wrapper to create read stream object
   * @param {string} Bucket
   * @param {string} Key
   * @param {Object} [options]
   */
  static createReadStream(Bucket, Key, options) {
    try {
      return (new AWS.S3({
        apiVersion: '2006-03-01',
        computeChecksums: true,
        signatureVersion: 'v4',
        s3DisableBodySigning: false,
        customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
      })).getObject(Object.assign({
        Bucket,
        Key,
        ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
      }, options)).createReadStream();
    } catch (e) {
      throw new Error(`${e.statusCode} ${e.code} ${Bucket}/${Key}`);
    }
  }

  /**
   * @static
   * @sync
   * @function selectS3Content
   * @description wrapper to S3.selectObjectContent api
   * @param {string} bucket
   * @param {string} key
   * @param {string} query
   */
  static async selectS3Content(bucket, key, query) {
    return new Promise((resolve, reject) => {
      /* escape single quote character */
      const escaped = query.replace(/'/g, '\'\'');
      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        computeChecksums: true,
        signatureVersion: 'v4',
        s3DisableBodySigning: false,
        customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
      });

      s3.selectObjectContent({
        Bucket: bucket,
        Key: key,
        ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
        ExpressionType: 'SQL',
        Expression: escaped,
        InputSerialization: {
          JSON: {
            Type: 'DOCUMENT',
          },
        },
        OutputSerialization: {
          JSON: {
            RecordDelimiter: ';',
          },
        },
      }, (e, response) => {
        if (e) {
          reject(e);
          return;
        }

        const stream = response.Payload;
        let payload = '';
        stream.on('error', e0 =>
          reject(e0));

        stream.on('end', () =>
          resolve(payload.split(';').filter(x => x).map(x => JSON.parse(x))));

        stream.on('data', (evt) => {
          if (evt.Records) {
            payload += evt.Records.Payload.toString();
          }
          /*
          else if (evt.Stats) {
            console.log(`event.Stats = ${JSON.stringify(evt.Stats, null, 2)}`);
          } else if (evt.Progress) {
            console.log(`event.Progress = ${JSON.stringify(evt.Progress, null, 2)}`);
          } else if (evt.Cont) {
            console.log(`event.Cont = ${JSON.stringify(evt.Cont, null, 2)}`);
          } else if (evt.End) {
            console.log(`event.End = ${JSON.stringify(evt.End, null, 2)}`);
          }
          */
        });
      });
    });
  }

  /**
   * @static
   * @async
   * @function restoreObject
   * @description wrapper to S3.restoreObject api
   * @param {string} bucket
   * @param {string} key
   * @param {Object} [options]
   */
  static async restoreObject(bucket, key, options) {
    return (new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    })).restoreObject(Object.assign({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }, options)).promise().catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${bucket}/${key}`);
    });
  }

  static async copyObject(source, bucket, key, options) {
    return (new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    })).copyObject(Object.assign({
      CopySource: source,
      Bucket: bucket,
      Key: key,
      MetadataDirective: 'COPY',
      TaggingDirective: 'COPY',
      ExpectedBucketOwner: Environment.S3.ExpectedBucketOwner,
    }, options)).promise().catch((e) => {
      throw new Error(`${e.statusCode} ${e.code} ${bucket}/${key}`);
    });
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

  /**
   * @static
   * @function pause - execution for specified duration
   * @param {number} duration - in milliseconds
   */
  static async pause(duration = 0) {
    return new Promise(resolve =>
      setTimeout(() => resolve(), duration));
  }

  /**
   * @static
   * @function toISODateTime
   * @description return date/time in YYYYMMDDThhmmss format
   * @param {*} [date]
   */
  static toISODateTime(date) {
    return ((date) ? new Date(date) : new Date())
      .toISOString()
      .split('.')
      .shift()
      .replace(/[-:]/g, '');
  }

  /**
   * @static
   * @function random
   * @param {number} [min] default to 0
   * @param {number} [max] default to 100
   */
  static random(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  /**
   * @static
   * @function isJSON
   * @description the string to see if is JSON string.
   * @param {string} s
   */
  static isJSON(s) {
    try {
      return (JSON.parse(s) && !!s);
    } catch (e) {
      return false;
    }
  }

  /**
   * @function getMime
   * @param {string} file
   * @returns {string} mime type
   */
  static getMime(file) {
    return M0.getMime(file);
  }

  /**
   * @static
   * @function getExtensionByMime
   * @description get file extension by mime type
   * @param {string} mime - mime type
   */
  static getExtensionByMime(mime) {
    return M0.getExtensionByMime(mime);
  }

  /**
   * @function parseMimeType
   * @param {string} mime - 'video/mp4', 'audio/mp4'
   */
  static parseMimeType(mime) {
    return M0.parseMimeType(mime);
  }

  /**
   * @function capitalize
   * @description capitalize first letter at word boundary
   * @param {string} name
   */
  static capitalize(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * @function timeToLiveInSecond
   * @description compute TTL
   * @param {number} days
   */
  static timeToLiveInSecond(days = 2) {
    return Math.floor((new Date().getTime() / 1000)) + (days * 86400);
  }

  /**
   * @static
   * @async
   * @function compressData
   * @description compress data with zlib and return slices of base64 compressed data in an array
   * @param {string|object} target - target first gets stringify before compressed
   * @param {number} [slice] - size per array item. default to 255 characters per array item
   * @return {Array} - slices of base64 compressed data
   */
  static async compressData(target, slice = 255) {
    const size = Math.max(10, slice);
    const t = (target instanceof Buffer)
      ? target
      : (typeof target === 'string')
        ? target
        : JSON.stringify(target);

    let buf = await new Promise((resolve, reject) =>
      ZLIB.gzip(t, (err, res) => (err ? reject(err) : resolve(res))));

    buf = buf.toString('base64');

    const response = [];
    while (buf.length) {
      response.push(buf.slice(0, size));
      buf = buf.slice(size);
    }
    return response;
  }

  /**
   * @static
   * @async
   * @function decompressData
   * @description decompress data with zlib and return JSON object (if parse-able) or buffer
   * @param {Array} target
   * @return {object|Buffer} - return JSON object if parseable. Otherwise, return buffer from unzip.
   */
  static async decompressData(target) {
    if (!Array.isArray(target)) {
      throw new Error('target must be Array object');
    }

    const buf = Buffer.from(target.join(''), 'base64');
    const response = await new Promise((resolve, reject) =>
      ZLIB.unzip(buf, (err, res) => (err ? reject(err) : resolve(res))));

    try {
      return JSON.parse(response.toString());
    } catch (e) {
      return response;
    }
  }

  static merge(target, source) {
    return X0.internalMerge(JSON.parse(JSON.stringify(target)), source);
  }

  static cleansing(obj, removeList) {
    const options = {
      array: true,
      object: true,
      ...removeList,
    };
    const parsed = X0.internalCleansing(JSON.parse(JSON.stringify(obj)), options);
    return JSON.parse(JSON.stringify(parsed));
  }

  static flatten(arr, depth = 1) {
    return X0.flatten(arr, depth);
  }

  static makeSafeOutputPrefix(uuid, key, keyword = '') {
    /* compatible with transcribe requirement */
    let safeKey = (!(/^[a-zA-Z0-9_.!*'()/-]{1,1024}$/.test(key)))
      ? key.replace(/[^a-zA-Z0-9_.!*'()/-]/g, '_')
      : key;
    if (safeKey[0] === '/') {
      safeKey = safeKey.slice(1);
    }
    const parsed = PATH.parse(safeKey);
    return PATH.join(
      uuid,
      parsed.dir,
      keyword,
      '/'
    );
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

const mxValidation = Base => class extends Base {
  /**
   * @static
   * @function validateBucket - validate bucket name
   * @description
   * * must be at least 3 and no more than 63 characters long
   * * must not contain uppercase characters or underscores
   * * must start with a lowercase letter or number
   * * must be a series of one or more labels. Adjacent labels are separated by a single period (.)
   * * must not be formatted as an IP address
   * @param {string} val - bucket name
   */
  static validateBucket(val = '') {
    return !(
      (val.length < 3 || val.length > 63)
      || /[^a-z0-9-.]/.test(val)
      || /^[^a-z0-9]/.test(val)
      || /\.{2,}/.test(val)
      || /^\d+.\d+.\d+.\d+$/.test(val)
    );
  }

  /**
   * @static
   * @function validateUuid - validate uuid
   * @description
   * * must be (hex)[8]-hex(4)-hex(4)-hex(4)-hex(12)
   * @param {string} val - uuid
   */
  static validateUuid(val = '') {
    return /^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(val);
  }

  /**
   * @static
   * @function validateCognitoIdentityId
   * @description cognito identity id is in a form of <region>:<uuid>
   * @param {string} val - id
   */
  static validateCognitoIdentityId(val = '') {
    return /^[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(val);
  }

  /**
   * @static
   * @function validateBase64JsonToken
   * @description dynamodb token is base64 encoded JSON object.
   * @param {string} val
   */
  static validateBase64JsonToken(val = '') {
    /* base64 token must be a JSON object */
    try {
      JSON.parse(Buffer.from(val, 'base64').toString());
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * @static
   * @function validateFaceCollectionId
   * @description face collection Id
   * * must be alphanumeric, '.', '_', '-' characters
   * @param {string} val
   */
  static validateFaceCollectionId(val = '') {
    return /^[a-zA-Z0-9_.-]+$/.test(val);
  }

  /**
   * @static
   * @function validateImageBlob
   * @description image blob
   * * must begin with data:image/[png|jpeg|jpg];base64,<BASE64_String>
   * @param {string} val
   */
  static validateImageBlob(val = '') {
    return /^data:image\/(png|jpeg|jpg);base64,.{20,}/.test(val);
  }

  /**
   * @static
   * @function validateS3Uri
   * @description validate string is in a format of s3://<bucket>/<key>
   * @param {string} val
   */
  static validateS3Uri(val = '') {
    const {
      protocol,
      hostname: bkt,
    } = URL.parse(val);

    if (!bkt || !protocol || protocol.toLowerCase() !== 's3:') {
      return false;
    }

    return !(
      (bkt.length < 3 || bkt.length > 63)
      || /[^a-z0-9-.]/.test(bkt)
      || /^[^a-z0-9]/.test(bkt)
      || /\.{2,}/.test(bkt)
      || /^\d+.\d+.\d+.\d+$/.test(bkt)
    );
  }

  /**
   * @static
   * @function validateStateMachineArn
   * @description validate state machine execution arn
   * @param {string} val
   */
  static validateStateMachineArn(val = '') {
    return /^arn:aws:states:[a-z\d-]+:\d{12}:execution:[a-zA-Z\d-_]+:[a-fA-F\d]{8}(-[a-fA-F\d]{4}){3}-[a-fA-F\d]{12}$/.test(val);
  }

  /**
   * @static
   * @function validateSageMakerWorkteamName
   * @description validate sagemaker ground truth team name
   * * must be alphanumeric and '-'
   * * must not be more than 63 characters
   * @param {string} val
   */
  static validateSageMakerWorkteamName(val = '') {
    return /^[a-zA-Z0-9-]{3,63}$/.test(val);
  }

  /**
   * @static
   * @function validateEmailAddress
   * @description validate email address
   * @param {string} val
   */
  static validateEmailAddress(val = '') {
    return /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(val);
  }
};

module.exports = {
  mxCommonUtils,
  mxNeat,
  mxValidation,
};
