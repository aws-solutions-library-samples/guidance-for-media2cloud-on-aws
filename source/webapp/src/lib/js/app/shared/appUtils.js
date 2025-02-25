// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import mxReadable from '../mixins/mxReadable.js';
import mxZero from '../mixins/mxZero.js';

const THUMBNAIL_W = 72;
const THUMBNAIL_H = THUMBNAIL_W;
const REGEX_UUID = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;

/**
 * @class AppUtils
 * @description common utility class for static functions
 */
export default class AppUtils extends mxReadable(mxZero(class {})) {
  /**
   * @function sanitize
   * @description prevent xss ingestion
   * @param {string} str
   */
  static sanitize(str) {
    return str.toString()
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('failed to load image'));
      };

      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  static async loadImage(url) {
    let blob = await fetch(url);
    blob = await blob.blob();

    blob = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(new Error('failed to load image'));
      }

      reader.readAsDataURL(blob);
    });

    return blob;
  }

  static validateUuid(uuid = '') {
    return REGEX_UUID.test(uuid);
  }
}
