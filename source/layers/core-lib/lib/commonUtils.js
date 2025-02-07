// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const CRYPTO = require('crypto');
const ZLIB = require('zlib');
const PATH = require('path');
const {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
  SelectObjectContentCommand,
  RestoreObjectCommand,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  getSignedUrl,
} = require('@aws-sdk/s3-request-presigner');
const Environment = require('./environment');
const xraysdkHelper = require('./xraysdkHelper');
const retryStrategyHelper = require('./retryStrategyHelper');
const MergeHelper = require('./mergeHelper');
const MimeTypeHelper = require('./mimeTypeHelper');
const ValidationHelper = require('./validationHelper');
const {
  M2CException,
} = require('./error');

const REGION = process.env.AWS_REGION;
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;
const EXPECTED_BUCKET_OWNER = Environment.S3.ExpectedBucketOwner;

class CommonUtils extends ValidationHelper {
  /**
   * @function unsignedUrl
   * @description convert Bucket / Key to HTTP URL
   * @param {object} params
   */
  static unsignedUrl(Bucket, Key) {
    return `https://${Bucket}.s3.${REGION}.amazonaws.com/${Key}`;
  }

  /**
   * @function headObject
   * @description wrap s3.headObject to intercept error message
   * @param {string} bucket
   * @param {string} key
   */
  static async headObject(bucket, key) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  /**
   * @function listObjects
   * @param {string} bucket
   * @param {string} prefix
   * @param {object} options
   */
  static async listObjects(
    bucket,
    prefix,
    options
  ) {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const _prefix = PATH.join(prefix, '/');

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: _prefix,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
      ...options,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  /**
   * @function getSignedUrl
   * @description return a signed url, default to expire in 2 hrs
   * @param {object} params
   */
  static async getSignedUrl(params) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetObjectCommand({
      Bucket: params.bucket || params.Bucket,
      Key: params.key || params.Key,
    });

    return getSignedUrl(
      s3Client,
      command,
      {
        expiresIn: 3600,
      }
    );
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
      throw new M2CException(`failed to generate UUID from '${str}'`);
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
  static async download(
    bucket,
    key,
    bodyOnly = true
  ) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });
    const response = await s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));

    if (bodyOnly) {
      return response.Body.transformToString();
    }

    return response;
  }

  /**
   * @function getByteRange
   * @param {string} bucket
   * @param {string} key
   * @param {number} startPosition
   * @param {number} byteLength
   */
  static async getByteRange(
    bucket,
    key,
    startPosition,
    byteLength
  ) {
    const start = Math.max(startPosition, 0);
    const end = start + (byteLength - 1);
    if (end <= start) {
      throw new M2CException(`invalid byte range, ${startPosition}, ${byteLength}`);
    }

    const range = `bytes=${start}-${end}`;

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: range,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    let response = await s3Client.send(command);
    response = await response.Body.transformToByteArray();

    return Buffer.from(response);
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

      let valid = params[cur]
        .split(';')
        .map((x) =>
          x.trim())
        .filter(x =>
          !invalidCharacter.test(x));

      if (valid.length > 0) {
        valid = valid
          .join('; ')
          .trim();
      } else {
        valid = undefined;
      }

      return {
        ...acc,
        [cur]: valid,
      };
    }, params);

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PutObjectCommand({
      ...modified,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  static async uploadFile(
    bucket,
    prefix,
    name,
    data
  ) {
    let body = data;
    if (!(typeof body === 'string' || body instanceof Buffer)) {
      body = JSON.stringify(data);
    }

    /* ensure header doesn't contain invalid character */
    let disposition = `attachment; filename="${name}"`;
    if (/[^\t\x20-\x7e\x80-\xff]/.test(name)) {
      disposition = 'attachment';
    }

    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, name);

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: MimeTypeHelper.getMime(name),
      ContentDisposition: disposition,
      ServerSideEncryption: 'AES256',
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  /**
   * @function sanitizedKey
   * @description make sure to trim leading '/' character
   * @param {string} str
   */
  static sanitizedKey(str = '') {
    return ((str[0] === '/') ? str.slice(1) : str).trim();
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
   * @param {string} bucket
   * @param {string} key
   * @returns {boolean}
   */
  static async deleteObject(bucket, key) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    return s3Client.send(command)
      .then(() =>
        true)
      .catch(() =>
        false);
  }

  /**
   * @async
   * @function getTags
   * @description wrapper to S3.getObjectTagging api
   * @param {string} Bucket
   * @param {string} Key
   */
  static async getTags(bucket, key) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetObjectTaggingCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  /**
   * @function tagObject
   * @description put object tagging
   * @param {string} bucket
   * @param {string} key
   * @param {Array} tagSet
   */
  static async tagObject(bucket, key, tagSet) {
    const curTagSet = await CommonUtils.getTags(
      bucket,
      key
    ).then((res) =>
      res.TagSet);

    const keys = tagSet
      .map((x) =>
        x.Key);

    /* ignoring existing tags if specified in the new tags */
    const filtered = curTagSet
      .filter((x) =>
        !keys.includes(x.Key));

    /* merge all tags */
    const merged = filtered.concat(tagSet);

    /* don't update tags if it exceeds the tag limits */
    if (merged.length > 10) {
      return undefined;
    }

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PutObjectTaggingCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
      Tagging: {
        TagSet: merged,
      },
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  /**
   * @static
   * @function createReadStream
   * @description wrapper to create read stream object
   * @param {string} bucket
   * @param {string} key
   * @param {Object} [options]
   */
  static async createReadStream(bucket, key, options) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
      ...options,
    });

    return s3Client.send(command)
      .then((res) =>
        res.Body);
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
    /* escape single quote character */
    const escaped = query.replace(/'/g, '\'\'');

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new SelectObjectContentCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
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
    });

    const chunks = [];

    const iterableStream = await s3Client.send(command)
      .then((res) =>
        res.Payload);

    for await (const eventStream of iterableStream) {
      if (eventStream.Records) {
        chunks.push(eventStream.Records.Payload);
      }
    }

    const json = Buffer.concat(chunks)
      .toString('utf8')
      .split(';')
      .filter((x) =>
        x)
      .map((x) =>
        JSON.parse(x));
    return json;
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
  static async restoreObject(
    bucket,
    key,
    options
  ) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new RestoreObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
      ...options,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  static async copyObject(
    source,
    bucket,
    key,
    options
  ) {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new CopyObjectCommand({
      CopySource: source,
      Bucket: bucket,
      Key: key,
      MetadataDirective: 'COPY',
      TaggingDirective: 'COPY',
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
      ...options,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
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
    [
      8,
      13,
      18,
      23,
    ].forEach((x) => {
      uuid[x] = '-';
    });

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
  static async pause(msec = 0) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, msec);
    });
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
    return CRYPTO.randomInt(
      Math.max(0, min),
      Math.max(1, max)
    );
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
   * @function capitalize
   * @description capitalize first letter at word boundary
   * @param {string} name
   */
  static capitalize(name) {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) =>
        c.toUpperCase());
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

    let buf = await new Promise((resolve, reject) => {
      ZLIB.gzip(t, (err, res) =>
        ((err)
          ? reject(err)
          : resolve(res)));
    });

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
      throw new M2CException('target must be Array object');
    }

    const buf = Buffer.from(target.join(''), 'base64');
    const response = await new Promise((resolve, reject) => {
      ZLIB.unzip(buf, (err, res) =>
        ((err)
          ? reject(err)
          : resolve(res)));
    });

    try {
      return JSON.parse(response.toString());
    } catch (e) {
      return response;
    }
  }

  static merge(target, source) {
    return MergeHelper.internalMerge(JSON.parse(JSON.stringify(target)), source);
  }

  static cleansing(obj, removeList) {
    const options = {
      array: true,
      object: true,
      ...removeList,
    };
    const parsed = MergeHelper.internalCleansing(JSON.parse(JSON.stringify(obj)), options);
    return JSON.parse(JSON.stringify(parsed));
  }

  static flatten(arr, depth = 1) {
    return MergeHelper.flatten(arr, depth);
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
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(uuid, parsed.dir, keyword, '/');
  }

  /**
   * @static
   * @function neat - empty properties that are undefined or null
   * @param {object} o - object
   */
  static neat(o) {
    const json = {
      ...o,
    };
    Object.keys(json)
      .forEach((x) => {
        if (json[x] === undefined || json[x] === null) {
          delete json[x];
        }
      });

    if (Object.keys(json).length === 0) {
      return undefined;
    }

    return json;
  }

  static toHHMMSS(msec, withMsec = false) {
    const HH = Math.floor(msec / 3600000);
    const MM = Math.floor((msec % 3600000) / 60000);
    const SS = Math.floor((msec % 60000) / 1000);

    let hhmmss = `${HH.toString().padStart(2, '0')}:${MM.toString().padStart(2, '0')}:${SS.toString().padStart(2, '0')}`;
    if (withMsec) {
      const mmm = Math.ceil(msec % 1000);
      hhmmss = `${hhmmss}.${mmm.toString().padStart(3, '0')}`;
    }

    return hhmmss;
  }
}

module.exports = CommonUtils;
