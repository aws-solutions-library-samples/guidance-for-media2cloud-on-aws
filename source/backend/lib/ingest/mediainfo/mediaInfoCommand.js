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

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const OS = require('os');
const FS = require('fs');
const URL = require('url');
const PATH = require('path');
const CHILD = require('child_process');

const AWS = require('aws-sdk');

const {
  Parser,
} = require('xml2js');

const {
  mxNeat,
} = require('../../shared/mxCommonUtils');

const CMD_OPTIONS = [
  '--Full',
  '--Output=XML',
];

/**
 * @class MediainfoError
 */
class MediainfoError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, MediainfoError);
  }
}

/**
 * @class MediaInfoCommand
 * @description run mediainfo command
 */
class MediaInfoCommand extends mxNeat(class {}) {
  constructor(options) {
    super();
    this.$executable = null;
    this.$s3Options = null;

    /* parsed mediainfo */
    this.$url = null;
    this.$version = null;
    this.$container = {};
    this.$videoES = [];
    this.$audioES = [];
    this.$textES = [];
    this.$rawData = null;

    this.initialize(options);
  }

  initialize(options) {
    if (options) {
      this.$s3Options = options;
    }

    this.$executable = (OS.platform() === 'darwin')
      ? 'mediainfo'
      : PATH.join(__dirname, 'bin', 'mediainfo');
  }

  get url() {
    return this.$url;
  }

  set url(val) {
    this.$url = val;
  }

  get version() {
    return this.$version;
  }

  set version(val) {
    this.$version = val;
  }

  get container() {
    return this.$container;
  }

  set container(val) {
    this.$container = val;
  }

  get rawData() {
    return this.$rawData;
  }

  set rawData(val) {
    this.$rawData = val;
  }

  get executable() {
    return this.$executable;
  }

  get s3Options() {
    return this.$s3Options;
  }

  get videoES() {
    return this.$videoES;
  }

  get audioES() {
    return this.$audioES;
  }

  get textES() {
    return this.$textES;
  }

  get metadata() {
    return MediaInfoCommand.neat({
      filename: this.url,
      container: this.container,
      video: (this.videoES.length) ? this.videoES : undefined,
      audio: (this.audioES.length) ? this.audioES : undefined,
      text: (this.textES.length) ? this.textES : undefined,
    });
  }

  toJSON() {
    return this.metadata;
  }

  /**
   * @static
   * @function findString
   * @param {*} str
   */
  static findString(str) {
    if (!str) {
      return undefined;
    }
    if (typeof str === 'string') {
      return str;
    }
    if (Array.isArray(str)) {
      return str.shift();
    }
    return Object.values(str).shift();
  }

  /**
   * @static
   * @function findNumber
   * @param {*} str
   */
  static findNumber(num) {
    if (num === undefined || num === null) {
      return undefined;
    }
    if (typeof num === 'string' || typeof num === 'number') {
      return Number(num);
    }
    if (Array.isArray(num)) {
      const n = num.filter(x => x.match(/^-?\d+\.?\d*$/)).shift();
      return (n) ? Number(n) : undefined;
    }
    return undefined;
  }

  /**
   * @function parseGeneralAttributes
   * @param {object} track
   */
  static parseGeneralAttributes(track) {
    return MediaInfoCommand.neat({
      format: MediaInfoCommand.findString(track.Format),
      mimeType: track.Internet_media_type,
      fileSize: MediaInfoCommand.findNumber(track.File_size),
      duration: MediaInfoCommand.findNumber(track.Duration),
      totalBitrate: MediaInfoCommand.findNumber(track.Overall_bit_rate),
    });
  }

  /**
   * @function parseCommonAttributes
   * @param {object} track
   */
  static parseCommonAttributes(track) {
    return MediaInfoCommand.neat({
      codec: MediaInfoCommand.findString(track.Format),
      profile: MediaInfoCommand.findString(track.Codec_profile),
      bitrate: MediaInfoCommand.findNumber(track.Bit_rate),
      duration: MediaInfoCommand.findNumber(track.Duration),
      frameCount: MediaInfoCommand.findNumber(track.Frame_count),
    });
  }

  /**
   * @function parseVideoAttributes
   * @param {object} track
   */
  static parseVideoAttributes(track) {
    return Object.assign(
      /* common attributes */
      MediaInfoCommand.parseCommonAttributes(track),
      /* video-specific attributes */
      MediaInfoCommand.neat({
        width: MediaInfoCommand.findNumber(track.Width),
        height: MediaInfoCommand.findNumber(track.Height),
        framerate: MediaInfoCommand.findNumber(track.Frame_rate),
        scanType: MediaInfoCommand.findString(track.Scan_type),
        aspectRatio: track.Display_aspect_ratio.filter(x => x.match(/:/)).shift(),
        bitDepth: MediaInfoCommand.findNumber(track.Bit_depth),
        colorSpace: `${MediaInfoCommand.findString(track.Color_space)} ${MediaInfoCommand.findString(track.Chroma_subsampling)}`,
      })
    );
  }

  /**
   * @function parseAudioAttributes
   * @param {object} track
   */
  static parseAudioAttributes(track) {
    return Object.assign(
      /* common attributes */
      MediaInfoCommand.parseCommonAttributes(track),
      /* audio-specific attributes */
      MediaInfoCommand.neat({
        bitrateMode: MediaInfoCommand.findString(track.Bit_rate_mode),
        language: MediaInfoCommand.findString(track.Language),
        channels: MediaInfoCommand.findNumber(track.Channel_s_),
        samplingRate: MediaInfoCommand.findNumber(track.Sampling_rate),
        samplePerFrame: MediaInfoCommand.findNumber(track.Samples_per_frame),
      })
    );
  }

  /**
   * @function parseTextAttributes
   * @param {object} track
   */
  static parseTextAttributes(track) {
    return MediaInfoCommand.neat({
      id: MediaInfoCommand.findString(track.ID),
      format: MediaInfoCommand.findString(track.Format),
      duration: MediaInfoCommand.findNumber(track.Duration),
      frameCount: MediaInfoCommand.findNumber(track.Count),
      captionServiceName: MediaInfoCommand.findNumber(track.CaptionServiceName),
    });
  }

  /**
   * @function parseXml
   * @param {string} xmlstr
   */
  async parseXml(xmlstr) {
    const promise = new Promise((resolve, reject) => {
      const xParser = new Parser({
        explicitArray: false,
      });
      xParser.parseString(xmlstr, (err, result) => {
        try {
          if (err) {
            throw err;
          }
          const { Mediainfo } = result;
          if (!Mediainfo) {
            throw new Error('Mediainfo element not found');
          }
          const { File } = Mediainfo;
          if (!File) {
            throw new Error('Mediainfo.File element not found');
          }
          const { track } = File;
          if (!track) {
            throw new Error('Mediainfo.File.track element not found');
          }
          resolve(result);
        } catch (e) {
          e.message = `MediaInfoCommand.parseXml: ${this.file} - ${e.message}`;
          reject(e);
        }
      });
    });
    return promise;
  }

  /**
   * @static
   * @function escapeS3Character
   * @description escape S3 special character if and only if
   * it is 'http' or 'https' and NOT a signed URL
   */
  static escapeS3Character(path) {
    const url = URL.parse(path, true);
    const {
      query: {
        AWSAccessKeyId,
        Signature,
      },
    } = url;
    /* if is signed url, nothing to do */
    if (AWSAccessKeyId && Signature) {
      return path;
    }
    /* replacing '+' with space character */
    url.pathname = encodeURI(decodeURI(url.pathname).replace(/\s/g, '+'));
    return URL.format(url);
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
    const promise = new Promise((resolve, reject) => {
      try {
        if (!params) {
          throw new Error('missing params');
        }
        if (typeof params === 'string') {
          if (MediaInfoCommand.isHttpProto(params)) {
            resolve(MediaInfoCommand.escapeS3Character(params));
            return;
          }
          /* local: check file existence */
          if (FS.existsSync(params)) {
            resolve(params);
            return;
          }
          throw new Error(`invalid file name, ${params}`);
        }
        /* must be S3 Object */
        const {
          Bucket,
          Key,
        } = params;
        if (!Bucket || !Key) {
          throw new Error(`missing Bucket or Key params, ${JSON.stringify(params)}`);
        }

        const options = Object.assign({
          apiVersion: '2006-03-01',
        }, this.s3Options);

        const s3 = new AWS.S3(options);
        const signedUrl = s3.getSignedUrl('getObject', {
          Bucket,
          Key: MediaInfoCommand.unescapeS3Character(Key),
          Expires: 60 * 60 * 2,
        });
        resolve(signedUrl);
      } catch (e) {
        e.message = `MediaInfoCommand.presign: ${e.message}`;
        reject(e);
      }
    });
    return promise;
  }

  /**
   * @function command
   * @description run mediainfo command
   * @param {string} url
   */
  async command(url) {
    const promise = new Promise((resolve, reject) => {
      const cmdline = `${this.executable} ${CMD_OPTIONS.join(' ')} '${url}'`;
      const child = CHILD.exec(cmdline, (err, stdout, stderr) => {
        try {
          if (err) {
            throw err;
          }
          if (stderr) {
            throw new Error(stderr);
          }
        } catch (e) {
          e.message = `MediaInfoCommand.command: ${url} - ${e.message}`;
          reject(e);
          return;
        }
        resolve(stdout);
      });
      child.once('error', (e) => {
        e.message = `MediaInfoCommand.command: ${url} - ${e.message}`;
        reject(e);
      });
    });
    return promise;
  }

  /**
   * @function analyze
   * @param {object|string} params
   */
  async analyze(params) {
    try {
      this.url = await this.presign(params);
      const xmlstr = await this.command(this.url);
      const parsed = await this.parseXml(xmlstr);
      const {
        Mediainfo: {
          $: {
            version,
          },
          File: {
            track: tracks,
          },
        },
      } = parsed;

      this.rawData = parsed;
      this.version = version;

      tracks.forEach((track) => {
        switch (track.$.type) {
          case 'General':
            this.container = MediaInfoCommand.parseGeneralAttributes(track);
            break;
          case 'Video':
            this.videoES.push(MediaInfoCommand.parseVideoAttributes(track));
            break;
          case 'Audio':
            this.audioES.push(MediaInfoCommand.parseAudioAttributes(track));
            break;
          case 'Text':
            this.textES.push(MediaInfoCommand.parseTextAttributes(track));
            break;
          default:
            process.env.ENV_QUIET || console.log(`Unsupported: ${track.$.type} = ${JSON.stringify(track, null, 2)}`);
            break;
        }
      });
      return this.toJSON();
    } catch (e) {
      throw (e instanceof MediainfoError) ? e : new MediainfoError(e);
    }
  }
}

module.exports = {
  MediainfoError,
  MediaInfoCommand,
};
