// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('aws-sdk');
  }
})();
const FS = require('fs');
const PATH = require('path');
const CHILD = require('child_process');
const {
  Parser,
  Builder,
} = require('xml2js');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

/**
 * @class MediaInfoError
 * @description Error code 1900
 */
class MediaInfoError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1900;
    this.message = `${this.errorCode} - ${this.message || 'unknown mediainfo error'}`;
    Error.captureStackTrace(this, MediaInfoError);
  }
}

/**
 * @class MediaInfoCommand
 * @description run mediainfo command
 */
class MediaInfoCommand {
  constructor(options) {
    this.$s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: CUSTOM_USER_AGENT,
      ...options,
    });
    this.$rawXml = undefined;
    this.$jsonData = undefined;
  }

  static GetConfiguration() {
    const subPath = 'amazon/linux2';
    return {
      LD_LIBRARY_PATH: PATH.join(__dirname, subPath),
      PATH: PATH.join(__dirname, subPath),
      MEDIAINFO: PATH.join(__dirname, subPath, 'mediainfo'),
    };
  }

  static get Constants() {
    return {
      Command: {
        Options: [
          '--Full',
          '--Output=XML',
          '--Cover_Data=base64',
        ],
      },
      /* minimum key set to return */
      KeySet: {
        Container: [
          'format',
          'fileSize',
          'duration',
          'frameRate',
          'overallBitRate',
        ],
        Video: [
          'streamOrder',
          'streamIdentifier',
          'format',
          'formatProfile',
          'formatLevel',
          'codec',
          'codecID',
          'bitRateMode',
          'bitRate',
          'width',
          'height',
          'pixelAspectRatio',
          'displayAspectRatio',
          'frameRate',
          'frameRateNominal', /* wmv framerate */
          'bitDepth',
          'scanType',
          'scanOrder',
          'timeCodeFirstFrame',
          'iD',
        ],
        Audio: [
          'streamOrder',
          'streamIdentifier',
          'format',
          'codec',
          'codecID',
          'bitDepth',
          'bitRateMode',
          'bitRate',
          'channels',
          'channelS',
          'channelLayout',
          'samplesPerFrame',
          'samplingRate',
          'language',
          'iD',
        ],
      },
    };
  }

  get s3() {
    return this.$s3;
  }

  get rawXml() {
    return this.$rawXml;
  }

  set rawXml(val) {
    this.$rawXml = val;
  }

  get jsonData() {
    return this.$jsonData;
  }

  set jsonData(val) {
    this.$jsonData = val;
  }

  get miniData() {
    return (!this.jsonData)
      ? undefined
      : {
        container: this.container.map(x => MediaInfoCommand.minifyPayload(x)),
        audio: this.audio.map(x => MediaInfoCommand.minifyPayload(x)),
        video: this.video.map(x => MediaInfoCommand.minifyPayload(x)),
      };
  }

  get video() {
    return !this.jsonData
      ? undefined
      : ((this.jsonData.mediaInfo.media || {}).track || []).filter(x => x.$.type.toLowerCase() === 'video');
  }

  get audio() {
    return !this.jsonData
      ? undefined
      : ((this.jsonData.mediaInfo.media || {}).track || []).filter(x => x.$.type.toLowerCase() === 'audio');
  }

  get container() {
    return !this.jsonData
      ? undefined
      : ((this.jsonData.mediaInfo.media || {}).track || []).filter(x => x.$.type.toLowerCase() === 'general');
  }

  get others() {
    return !this.jsonData
      ? undefined
      : ((this.jsonData.mediaInfo.media || {}).track || []).filter(x =>
        x.$.type.toLowerCase() !== 'general'
        && x.$.type.toLowerCase() !== 'audio'
        && x.$.type.toLowerCase() !== 'video');
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this.jsonData));
  }

  toXML() {
    return (new Builder()).buildObject(this.jsonData);
  }

  static minifyPayload(data) {
    let keyset = [];
    switch (data.$.type.toLowerCase()) {
      case 'general':
        keyset = MediaInfoCommand.Constants.KeySet.Container;
        break;
      case 'video':
        keyset = MediaInfoCommand.Constants.KeySet.Video;
        break;
      case 'audio':
        keyset = MediaInfoCommand.Constants.KeySet.Audio;
        break;
      default:
        break;
    }
    return keyset.reduce((acc, cur) =>
      Object.assign(acc, {
        [cur]: data[cur],
      }), {});
  }

  /**
   * @function parseXml
   * @param {string} xmlstr
   */
  async parseXml(xml) {
    return new Promise((resolve, reject) => {
      const xParser = new Parser({
        explicitArray: false,
      });
      xParser.parseString(xml.toString(), (e, data) =>
        ((e) ? reject(e) : resolve(data)));
    });
  }

  /**
   * @static
   * @function escapeS3Character
   * @description escape S3 special character if and only if
   * it is 'http' or 'https' and NOT a signed URL
   */
  static escapeS3Character(path) {
    const url = new URL(path);
    /* if is a signed url, nothing to do */
    if (url.searchParams.get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256') {
      return path;
    }
    /* replacing '+' with space character */
    url.pathname = encodeURI(decodeURI(url.pathname).replace(/\s/g, '+'));
    return url.toString();
  }

  /**
   * @static
   * @function isHttpProto
   * @param {string} path
   */
  static isHttpProto(path) {
    return (path.indexOf('https:') === 0 || path.indexOf('http:') === 0);
  }

  /**
   * @static
   * @function unescapeS3Character
   * @description convert '+' back to space character
   * @param {string} key - object key
   */
  static unescapeS3Character(key) {
    return key.replace(/\+/g, ' ');
  }

  /**
   * @function presign
   * @param {object|string} params
   */
  async presign(params) {
    return new Promise((resolve, reject) => {
      if (!params) {
        reject(new Error('missing params'));
        return;
      }

      if (typeof params === 'string') {
        if (MediaInfoCommand.isHttpProto(params)) {
          resolve(MediaInfoCommand.escapeS3Character(params));
          return;
        }
        if (FS.existsSync(params)) {
          resolve(params);
          return;
        }
        reject(new Error(`invalid filename '${params}' not supported`));
        return;
      }

      if (typeof params === 'object' && (!params.Bucket || !params.Key)) {
        reject(new Error(`missing Bucket and Key, ${JSON.stringify(params)}`));
        return;
      }

      resolve(this.s3.getSignedUrl('getObject', {
        Bucket: params.Bucket,
        Key: params.Key,
        Expires: 60 * 60 * 2,
      }));
    });
  }

  /**
   * @function command
   * @description run mediainfo command
   * @param {string} url
   */
  async command(url) {
    const config = MediaInfoCommand.GetConfiguration();
    const ldLibraryPath = [
      config.LD_LIBRARY_PATH,
      process.env.LD_LIBRARY_PATH,
    ].filter(x => x).join(':');
    const defaults = {
      cwd: undefined,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: ldLibraryPath,
      },
    };
    const params = [
      ...MediaInfoCommand.Constants.Command.Options,
      url,
    ];
    const response = CHILD.spawnSync(config.MEDIAINFO, params, defaults);
    if (response.error) {
      throw response.error;
    }
    if (response.status !== 0) {
      throw new Error(response.stderr.toString());
    }
    return response.stdout.toString();
  }

  /**
   * @function analyze
   * @param {object|string} params
   */
  async analyze(params) {
    try {
      let parsed;
      parsed = await this.presign(params);
      this.rawXml = await this.command(parsed);
      parsed = await this.parseXml(this.rawXml);
      parsed = MediaInfoCommand.dedup(parsed);
      this.jsonData = MediaInfoCommand.strip(params, parsed);
      return this.toJSON();
    } catch (e) {
      throw (e instanceof MediaInfoError) ? e : new MediaInfoError(e);
    }
  }

  static strip(params, data) {
    let ref;
    let ext;
    if (typeof params === 'string') {
      if (MediaInfoCommand.isHttpProto(params)) {
        const url = new URL(params);
        ref = `${url.protocol}//${url.hostname}${url.pathname}`;
        ext = PATH.parse(url.pathname).ext.slice(1);
      } else {
        ref = params;
        ext = PATH.parse(params).ext.slice(1);
      }
    } else {
      ref = `s3://${params.Bucket}/${params.Key}`;
      ext = PATH.parse(params.Key).ext.slice(1);
    }

    const modified = Object.assign({}, data);
    modified.mediaInfo.media.$.ref = ref;

    for (let i = 0; i < modified.mediaInfo.media.track.length; i++) {
      const track = modified.mediaInfo.media.track[i];
      if (track.completeName !== undefined) {
        track.completeName = ref;
      }
      if (track.fileNameExtension !== undefined) {
        track.fileNameExtension = ext;
      }
      if (track.fileExtension !== undefined) {
        track.fileExtension = ext;
      }
    }
    return modified;
  }

  static dedup(data) {
    function camelCaseKey(k0, obj) {
      const k1 = (k0 === '_' || k0 === '$')
        ? k0
        : k0.replace(/^([A-Za-z])|[\s-_.]{1,}(\w)/g, (ignored, p1, p2) =>
          ((p2) ? p2.toUpperCase() : p1.toLowerCase())).replace(/[\s-_.]$/, '');
      if (k1 !== k0) {
        obj[k1] = obj[k0];
        delete obj[k0];
      }
      return k1;
    }

    function flatten(a0) {
      if (!Array.isArray(a0) || a0.findIndex(x => typeof x === 'object') >= 0) {
        return a0;
      }
      const a1 = Array.from(new Set(a0));
      let v0 = a1[0];
      while (a1.length) {
        v0 = convertType(a1.shift());
        if (typeof v0 === 'number') {
          return v0;
        }
      }
      return v0;
    }

    function convertType(v0) {
      if (typeof v0 !== 'string') {
        return v0;
      }
      let v1 = v0.trim();
      if (/^true$/i.test(v1)) {
        v1 = true;
      } else if (/^false$/i.test(v1)) {
        v1 = false;
      } else if (/^[-|+]{0,1}\d+$/.test(v1) || /^[-|+]{0,1}\d+\.\d+$/.test(v1)) {
        const num = Number.parseFloat(v1);
        if (num >= Number.MIN_SAFE_INTEGER && num <= Number.MAX_SAFE_INTEGER) {
          v1 = num;
        }
      }
      return v1;
    }

    function tranverse(obj) {
      Object.keys(obj).forEach((k0) => {
        const k1 = camelCaseKey(k0, obj);
        obj[k1] = flatten(obj[k1]);
        obj[k1] = convertType(obj[k1]);
        if (obj[k1] !== undefined && obj[k1] !== null && typeof obj[k1] === 'object') {
          tranverse(obj[k1]);
        }
      });
    }

    const modified = Object.assign({}, data);
    tranverse(modified);
    return modified;
  }
}

module.exports = {
  MediaInfoError,
  MediaInfoCommand,
  MediaInfoConfig: MediaInfoCommand.GetConfiguration(),
  XParser: Parser,
  XBuilder: Builder,
};
