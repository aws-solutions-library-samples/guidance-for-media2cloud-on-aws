// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  CommonUtils,
} = require('core-lib');
const {
  Exiftool,
  Jimp,
} = require('image-process-lib');

const MAX_IMAGE_SIZE = 14 * 1000 * 1000;
const MAX_THUMBNAIL_WIDTH = 480;
const MAX_THUMBNAIL_HEIGHT = 270;

class ImageProcess {
  constructor(stateData) {
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'ImageProcess';
  }

  get stateData() {
    return this.$stateData;
  }

  isFormatSupported(key) {
    const extension = PATH.parse(key).ext.toLowerCase();
    switch (extension) {
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.bmp':
      case '.tif':
      case '.tiff':
      case '.gif':
        return true;
      default:
        break;
    }
    return false;
  }

  parseOrientation(orientation) {
    const response = {
      flipH: false,
      flipV: false,
      rotate: 0,
    };

    if (!orientation) {
      return response;
    }

    const x0 = orientation.toLowerCase();
    if (x0.indexOf('mirror') >= 0) {
      if (x0.indexOf('vertical') >= 0) {
        response.flipV = true;
      } else if (x0.indexOf('horizontal') >= 0) {
        response.flipH = true;
      }
    }

    if (x0.indexOf('rotate' >= 0)) {
      const matched = x0.match(/rotate\s(\d+)/);
      if (matched) {
        response.rotate = Number.parseInt(matched[1], 10);
      }
    }

    return response;
  }

  async createImage(buffer, orient, maxW, maxH) {
    let image = await new Promise((resolve, reject) => {
      Jimp.read(buffer)
        .then((data) => resolve(data))
        .catch((e) => reject(e));
    });

    /* resize image if needed */
    let factor = 1;
    const imgW = image.getWidth();
    const imgH = image.getHeight();
    if (maxW && imgW > maxW) {
      factor = Math.min(factor, maxW / imgW);
    }
    if (maxH && imgH > maxH) {
      factor = Math.min(factor, maxH / imgH);
    }
    if (factor !== 1) {
      image = image.scale(factor);
    }

    /* Max image size allowed for Rekognition is 15MB */
    let buf = await image.getBufferAsync(Jimp.MIME_JPEG);
    if (buf.byteLength > MAX_IMAGE_SIZE) {
      factor = MAX_IMAGE_SIZE / buf.byteLength;
      image = image.scale(factor);
      buf = await image.getBufferAsync(Jimp.MIME_JPEG);
    }
    return buf;
  }

  async normalizePreviewImage(buffer, orient) {
    return (!buffer)
      ? this.createPreviewImage(orient)
      : this.createImage(
        buffer,
        orient
      );
  }

  async normalizeThumbnailImage(buffer, orient) {
    return (!buffer)
      ? this.createThumbnailImage(orient)
      : this.createImage(
        buffer,
        orient,
        MAX_THUMBNAIL_WIDTH,
        MAX_THUMBNAIL_HEIGHT
      );
  }

  async createPreviewImage(orient) {
    const src = this.stateData.input || {};
    if (!this.isFormatSupported(src.key)) {
      return undefined;
    }

    const response = await CommonUtils.download(src.bucket, src.key, false);
    return this.createImage(
      response.Body,
      orient
    );
  }

  async createThumbnailImage(orient) {
    const src = this.stateData.input || {};
    if (!this.isFormatSupported(src.key)) {
      return undefined;
    }

    const response = await CommonUtils.download(src.bucket, src.key, false);
    return this.createImage(
      response.Body,
      orient,
      MAX_THUMBNAIL_WIDTH,
      MAX_THUMBNAIL_HEIGHT
    );
  }

  sanitizeExif(exif) {
    if (!exif) {
      return undefined;
    }

    return Object.keys(exif).reduce((acc, key) => {
      let value = exif[key];
      if (typeof value === 'string') {
        value = value.trim();
        value = !value.length ? undefined : value;
      } else if (Array.isArray(value)) {
        value = value.map(x => x.toString()).join(',');
        value = !value.length ? undefined : value;
      }
      return Object.assign(acc, {
        [key]: value,
      });
    }, {});
  }

  async getImageInfo() {
    const src = this.stateData.input || {};

    const imageinfo = await this.runExiftool(src.bucket, src.key);
    imageinfo.exif = this.sanitizeExif(imageinfo.exif);

    const orientation = this.parseOrientation((imageinfo.exif || {}).Orientation);

    imageinfo.preview =
      await this.normalizePreviewImage(imageinfo.preview, orientation)
        .catch((e) => {
          console.error(e);
          throw e;
        });

    imageinfo.thumbnail =
      await this.normalizeThumbnailImage(imageinfo.preview, orientation)
        .catch((e) => {
          console.error(e);
          /* make thumbnail optional */
          return undefined;
        });

    return imageinfo;
  }

  async runExiftool(bucket, key) {
    const exif = new Exiftool();
    return exif.extract(bucket, key);
  }

  async createProxy() {
    return undefined;
  }
}

module.exports = ImageProcess;
