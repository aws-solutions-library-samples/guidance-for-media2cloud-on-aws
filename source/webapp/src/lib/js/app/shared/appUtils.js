// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import mxReadable from '../mixins/mxReadable.js';
import mxZero from '../mixins/mxZero.js';
import SigV4Client from './signer.js';

const THUMBNAIL_W = 72;
const THUMBNAIL_H = THUMBNAIL_W;

class MimeWrapper {
  constructor() {
    MimeWrapper.$.define({
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
    }, true);
  }

  static get $() {
    return window.AWSomeNamespace.Mime;
  }

  static getSingleton() {
    if (!(window.AWSomeNamespace || {}).MimeSingleton) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        MimeSingleton: new MimeWrapper(),
      };
    }
    return window.AWSomeNamespace.MimeSingleton;
  }

  getMime(data) {
    return (typeof data === 'string')
      ? MimeWrapper.$.getType(data)
      : (data || {}).type
        ? data.type
        : (data || {}).mime
          ? data.mime
          : (data || {}).name
            ? MimeWrapper.$.getType(data.name)
            : (data || {}).key
              ? MimeWrapper.$.getType(data.key)
              : undefined;
  }

  getKind(data) {
    const [
      type,
      subtype,
    ] = (this.getMime(data) || '').split('/').filter(x => x)
      .map(x => x.toLowerCase());
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
 * @class AppUtils
 * @description common utility class for static functions
 */
export default class AppUtils extends mxReadable(mxZero(class {})) {
  /**
   * @function signRequest
   * @description sign V4 request
   * @param {string} method
   * @param {string} endpoint
   * @param {string} path
   * @param {object} query
   * @param {string|object} body
   */
  static signRequest(method, endpoint, path, query, body) {
    const signer = new SigV4Client({
      accessKey: AWS.config.credentials.accessKeyId,
      secretKey: AWS.config.credentials.secretAccessKey,
      sessionToken: AWS.config.credentials.sessionToken,
      region: AWS.config.region,
      serviceName: 'execute-api',
      endpoint,
    });

    const response = signer.signRequest({
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
      },
      queryParams: query,
      body: (typeof body === 'string') ? body : JSON.stringify(body),
    });

    return response;
  }

  /**
   * @function authHttpRequest
   * @description http request with signed payload/headers
   * @param {string} method
   * @param {string} endpoint
   * @param {string} path
   * @param {object} query
   * @param {string|object} body
   */
  static async authHttpRequest(method, endpoint, query = {}, body = '') {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const qs = JSON.parse(JSON.stringify(query));
      const {
        url, headers,
      } = AppUtils.signRequest(method, endpoint, '', qs, body);

      request.open(method, url, true);

      Object.keys(headers).forEach((x) => {
        request.setRequestHeader(x, headers[x]);
      });

      request.withCredentials = false;

      request.onerror = e => reject(e);

      request.onabort = e => reject(e);

      request.onreadystatechange = () => {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            if (request.responseText === undefined
              || !request.responseText.length) {
              return resolve(undefined);
            }
            const parsed = JSON.parse(request.responseText);
            if (parsed.errorCode) {
              console.error(`[ERR]: ${parsed.errorCode} - ${encodeURIComponent(parsed.errorMessage)}`);
              return reject(new Error(`${parsed.errorCode} - ${parsed.errorMessage}`));
            }
            return resolve(JSON.parse(request.responseText));
          }
          if (request.status >= 400) {
            return reject(new Error(`${request.status} - ${request.responseURL}`));
          }
        }
        return undefined;
      };

      request.send((typeof body === 'string')
        ? body
        : JSON.stringify(body));
    });
  }

  /**
   * @function sanitize
   * @description prevent xss ingestion
   * @param {string} str
   */
  static sanitize(str) {
    return str.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * @static
   * @function pause - sleep for specified duration
   * @param {number} duration - in milliseconds
   */
  static async pause(duration = 0) {
    return new Promise((resolve) => {
      setTimeout(() =>
        resolve(), duration);
    });
  }

  /**
   * @function loading
   * @description show spinning icon
   * @param {string} id - dom id of the loading icon
   * @param {boolean} [show] - show or hide
   */
  static loading(id = 'spinning-icon', show = true) {
    if (show) {
      $(`#${id}`).removeClass('collapse');
    } else {
      $(`#${id}`).addClass('collapse');
    }
  }

  /**
   * @function uuid4
   * @description check or generate uuid
   * @param {string} [str] - check string if it is uuid
   */
  static uuid4(str) {
    const s0 = (str || CryptoJS.lib.WordArray.random(16)).toString();
    const matched = s0.match(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/);
    if (!matched) {
      throw new Error(`failed to generate uuid from '${s0}'`);
    }
    matched.shift();
    return matched.join('-').toLowerCase();
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
    if (encoded === format) {
      return md5;
    }

    const words = (encoded === 'hex')
      ? CryptoJS.enc.Hex.parse(md5)
      : CryptoJS.enc.Base64.parse(md5);

    return (format === 'hex')
      ? CryptoJS.enc.Hex.stringify(words)
      : CryptoJS.enc.Base64.stringify(words);
  }

  static get Mime() {
    return MimeWrapper.getSingleton();
  }

  static randomHexstring() {
    const rnd = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    return rnd[0].toString(16);
  }

  static randomNumber(max = 1000, min = 0) {
    const rand = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(rand);
    const range = Math.max(1, (max - min + 1));
    return (rand[0] % range) + min;
  }

  static randomRGB() {
    const rand = new Uint32Array(3);
    (window.crypto || window.msCrypto).getRandomValues(rand);
    const r = (rand[0] % 256);
    const g = (rand[1] % 256);
    const b = (rand[2] % 256);
    return `rgb(${r}, ${g}, ${b})`;
  }

  static randomRGBNumber() {
    const rand = new Uint32Array(3);
    (window.crypto || window.msCrypto).getRandomValues(rand);
    return [
      (rand[0] % 256),
      (rand[1] % 256),
      (rand[2] % 256),
    ];
  }

  static parsePrefix(path) {
    return (!path || path[path.length - 1] === '/')
      ? path
      : path.substring(0, path.lastIndexOf('/'));
  }

  static toFriendlyName(name) {
    return (name || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) =>
        c.toUpperCase());
  }

  static async downscale(url, width = THUMBNAIL_W, height = THUMBNAIL_H) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('missing url'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scaleW = width / img.width;
        const scaleH = height / img.height;
        const scale = Math.max(scaleW, scaleH);
        let canvasW = Math.floor(img.width * scale);
        canvasW -= canvasW % 2;
        let canvasH = Math.floor(img.height * scale);
        canvasH -= canvasH % 2;
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvasW, canvasH);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      };
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }
}
