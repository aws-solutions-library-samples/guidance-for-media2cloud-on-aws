// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const PATH = require('path');
const {
  CommonUtils,
} = require('core-lib');
const {
  Exiftool,
  Jimp,
} = require('image-process-lib');

const MAX_FILESIZE = 15 * 1000 * 1000;
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
      const matched = x0.match(/rotate\s([0-9]+)/);
      if (matched) {
        response.rotate = Number.parseInt(matched[1], 10);
      }
    }

    return response;
  }

  async createImage(buffer, orient, maxW, maxH) {
    return new Promise((resolve) => {
      Jimp.read(buffer).then(async (image) => {
        let img = image;

        let factor = 1;
        if (maxW && image.getWidth() > maxW) {
          factor = Math.min(factor, maxW / image.getWidth());
        }
        if (maxH && image.getHeight() > maxH) {
          factor = Math.min(factor, maxH / image.getHeight());
        }
        if (factor !== 1) {
          img = image.scale(factor);
        }
        /*
        if (orient.flipH || orient.flipV) {
          img = img.mirror(orient.flipH, orient.flipV);
        }
        if (orient.rotate) {
          img = img.rotate(orient.rotate);
        }
        */
        /* make sure file size is less than 15MB */
        let buf = await img.getBufferAsync(Jimp.MIME_JPEG);
        if (buf.byteLength > MAX_FILESIZE) {
          factor = MAX_FILESIZE / buf.byteLength;
          img = img.scale(factor);
          buf = await img.getBufferAsync(Jimp.MIME_JPEG);
        }
        resolve(buf);
      }).catch(() => undefined);
    });
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
      await this.normalizePreviewImage(imageinfo.preview, orientation);

    imageinfo.thumbnail =
      await this.normalizeThumbnailImage(imageinfo.preview, orientation);

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
