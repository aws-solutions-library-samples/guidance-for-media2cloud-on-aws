// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const anyBase = require('any-base');
const {
  getSignedUrl,
  download,
  headObject,
} = require('./commonUtils');

let Jimp;

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
const toBinary = anyBase(alphabet, anyBase.BIN);

const HASH_BLACKFRAME = '0000000000000000000000000000000000000000000000000000000000000000';
const HASH_EBU_COLORBAR = '1000000010000000100000001000000010000000100000001000000000000000'; // '820w820w800'

const LaplacianKernel = [
  [0, 1, 0],
  [1, -4, 1],
  [0, 1, 0],
];

const BORDERSIZE = 2;
const BORDERCOLOR = 0xffffffff; // white border

class JimpHelper {
  static get MIME_JPEG() {
    return 'image/jpeg';
  }

  static get MIME_PNG() {
    return 'image/png';
  }

  static async loadImage(bucket, key) {
    const image = await _loadImage(bucket, key);
    return image;
  }

  static async imageFromS3(bucket, key) {
    const image = await _imageFromS3(bucket, key);
    return image;
  }

  static async imageFromBuffer(buf) {
    const jimpLib = _getJimpLib();
    return jimpLib.read(buf);
  }

  static async imageFromScratch(w, h, color) {
    const image = await _imageFromScratch(w, h, color);
    return image;
  }

  static drawBorder(image, x, y, w, h, borderSize, borderColor) {
    return _drawBorder(image, x, y, w, h, borderSize, borderColor);
  }

  static async computeHash(image) {
    return image.hash();
  }

  static async computeLaplacianVariance(image) {
    return new Promise((resolve) => {
      const singleChannel = [];
      let sum = 0;

      const tmp = image
        .clone()
        .convolute(LaplacianKernel);

      tmp.scan(0, 0, tmp.bitmap.width, tmp.bitmap.height, (px, py, idx) => {
        const rgba = tmp.bitmap.data;
        const r = rgba[idx + 0];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];

        const weighted = (r * 0.299) + (g * 0.587) + (b * 0.114);
        singleChannel.push(weighted);
        sum += weighted;
      });

      const mean = sum / singleChannel.length;

      let variance = (singleChannel
        .reduce((a, c) =>
          a + (c - mean) ** 2, 0));

      variance /= (singleChannel.length - 1);

      resolve(Math.round(variance));
    });
  }

  static compareHashes(a, b) {
    if (a === undefined || b === undefined || a === 'undefined' || b === 'undefined') {
      return 0;
    }

    const jimpLib = _getJimpLib();
    const binA = toBinary(a).padStart(64, '0');
    const binB = toBinary(b).padStart(64, '0');
    return jimpLib.compareHashes(binA, binB);
  }

  static distanceToBlack(a) {
    const jimpLib = _getJimpLib();
    const binA = toBinary(a).padStart(64, '0');
    const d = jimpLib.compareHashes(binA, HASH_BLACKFRAME);
    return d;
  }

  static ignoreKnownHashes(a) {
    const jimpLib = _getJimpLib();

    const binA = toBinary(a).padStart(64, '0');
    for (const binB of [HASH_BLACKFRAME, HASH_EBU_COLORBAR]) {
      const d = jimpLib.compareHashes(binA, binB);
      if (d < 0.10) {
        return true;
      }
    }
    return false;
  }
}

//
// Dynamically load jimp library and apply JpegDecoder patch
//
// WORKAROUND: JIMP 0.16.1 (0.9.6 doesn't have the issue.)
// jpeg-js decoder throws an error when maxMemoryUsageInMB > 512
// Reference: https://github.com/oliver-moran/jimp/issues/915
//
function _getJimpLib() {
  if (Jimp === undefined) {
    try {
      Jimp = require('jimp');
      return _patchJpegDecoder(Jimp);
    } catch (e) {
      Jimp = e;
    }
  }

  if (Jimp instanceof Error) {
    throw Jimp;
  }
  return Jimp;
}

function _patchJpegDecoder(jimpLib) {
  const JpegDecoder = jimpLib.decoders['image/jpeg'];

  jimpLib.decoders['image/jpeg'] = (data) =>
    JpegDecoder(data, {
      maxResolutionInMP: 200,
      maxMemoryUsageInMB: 2048,
    });

  return jimpLib;
}

async function _loadImage(bucket, key) {
  const jimpLib = _getJimpLib();

  let retries = 2;
  do {
    try {
      const signed = await getSignedUrl({
        Bucket: bucket,
        Key: key,
      });

      const image = await jimpLib.read(signed);

      return image;
    } catch (e) {
      e;
      await _pause();
    }
  } while ((retries--) > 0);

  throw new Error(`JimpHelper: fail to load image from s3://${bucket}/${key}`);
}

async function _imageFromS3(bucket, key) {
  try {
    let image = await _loadImage(bucket, key)
      .catch(() => undefined);

    if (image) {
      return image;
    }

    // see if the file actually exists
    await headObject(bucket, key);

    // download and load image from buffer
    image = await download(bucket, key, false)
      .then((res) =>
        res.Body.transformToByteArray());
    image = await image;

    const jimpLib = _getJimpLib();
    image = await jimpLib.read(Buffer.from(image));

    return image;
  } catch (e) {
    console.log(e);
    throw new Error(`imageFromS3 failed to load ${key}`);
  }
}

async function _imageFromScratch(w, h, color = BORDERCOLOR) {
  let promise = new Promise((resolve, reject) => {
    const jimpLib = _getJimpLib();
    const ignored = new jimpLib(w, h, color, (e, img) => {
      if (e) {
        reject(e);
      } else {
        resolve(img);
      }
    });
    ignored;
  });

  promise = await promise;

  return promise;
}

function _drawBorder(image, x, y, w, h, borderSize = BORDERSIZE, borderColor = BORDERCOLOR) {
  const imgW = image.bitmap.width;
  const imgH = image.bitmap.height;

  const x1 = (Math.max(x, 0) >> 1) << 1;
  const y1 = (Math.max(y, 0) >> 1) << 1;

  let w1 = w;
  if ((x1 + w1 + borderSize) > imgW) {
    w1 = ((imgW - x1 - borderSize) >> 1) << 1;
  }

  let h1 = h;
  if ((y1 + h1 + borderSize) > imgH) {
    h1 = ((imgH - y1 - borderSize) >> 1) << 1;
  }

  const coords = [
    [x1, y1, w1, borderSize],
    [x1, y1 + h1, w1, borderSize],
    [x1, y1, borderSize, h1],
    [x1 + w1, y1, borderSize, h1],
  ];

  for (const coord of coords) {
    image.scan(...coord, (x0, y0, offset) => {
      image.bitmap.data.writeUInt32BE(borderColor, offset, true);
    });
  }

  return image;
}

async function _pause(milliseconds = 200) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}

module.exports = JimpHelper;
