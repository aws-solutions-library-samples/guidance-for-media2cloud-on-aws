// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  CommonUtils,
  JimpHelper: {
    MIME_JPEG,
    imageFromBuffer,
  },
} = require('core-lib');
const {
  RunExifTool,
} = require('./exiftool');

const MAX_IMAGE_SIZE = 5 * 1000 * 1000;
const MAX_THUMBNAIL_WIDTH = 480;
const MAX_THUMBNAIL_HEIGHT = 270;

const TIFF_EXTENSIONS = ['.tif', '.tiff'];

class ImageProcess {
  constructor(stateData) {
    this.$stateData = stateData;
    _workaroundTIFFCMYKColorFormat(stateData);
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
      const matched = x0.match(/rotate\s([0-9]+)/);
      if (matched) {
        response.rotate = Number.parseInt(matched[1], 10);
      }
    }

    return response;
  }

  async createImage(buffer, orient, maxW, maxH) {
    let image = await imageFromBuffer(buffer);

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

    /*
    if (orient.flipH || orient.flipV) {
      image = image.mirror(orient.flipH, orient.flipV);
    }
    if (orient.rotate) {
      image = image.rotate(orient.rotate);
    }
    */

    /* Max image size allowed for Rekognition is 15MB */
    let buf = await image.getBufferAsync(MIME_JPEG);
    if (buf.byteLength > MAX_IMAGE_SIZE) {
      factor = MAX_IMAGE_SIZE / buf.byteLength;
      image = image
        .scale(factor)
        .quality(80);
      buf = await image.getBufferAsync(MIME_JPEG);
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

    let response = await CommonUtils.download(
      src.bucket,
      src.key,
      false
    );
    response = Buffer.from(await response.Body.transformToByteArray());

    return this.createImage(
      response,
      orient
    );
  }

  async createThumbnailImage(orient) {
    const src = this.stateData.input || {};
    if (!this.isFormatSupported(src.key)) {
      return undefined;
    }

    let response = await CommonUtils.download(
      src.bucket,
      src.key,
      false
    );
    response = Buffer.from(await response.Body.transformToByteArray());

    return this.createImage(
      response,
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

    const imageinfo = await RunExifTool(
      src.bucket,
      src.key
    ).then((res) => {
      res.exif = this.sanitizeExif(res.exif);
      return res;
    });

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

  async createProxy() {
    return undefined;
  }
}

// WORKAROUND:
// TIFF decoder package looks for "window" object when color space is CMYK
// @jimp/node_modules/utif2/utif.js#1415
function _workaroundTIFFCMYKColorFormat(data) {
  const {
    input: {
      key,
    },
  } = data;

  const ext = PATH.parse(key).ext.toLowerCase();

  if (TIFF_EXTENSIONS.includes(ext)) {
    if (global.window === undefined) {
      global.window = {};
    }
  }
}

module.exports = ImageProcess;
