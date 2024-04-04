// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const MIME = require('mime');

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

const MAJOR_TYPES = [
  'video',
  'audio',
  'image',
];

const SUBTYPES_VIDEO = [
  'mxf',
  'gxf',
];

const SUBTYPES_DOCUMENT = [
  'pdf',
];

class MimeTypeHelper {
  /**
   * @function getMime
   * @param {string} file
   * @returns {string} mime type
   */
  static getMime(file) {
    MIME.define(RAW_IMAGE_MIME_TYPES, true);
    return MIME.getType(file)
      || 'application/octet-stream';
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
    ] = (mime || '')
      .split('/')
      .filter((x) =>
        x)
      .map((x) =>
        x.toLowerCase());

    if (MAJOR_TYPES.includes(type)) {
      return type;
    }
    if (SUBTYPES_VIDEO.includes(subtype)) {
      return 'video';
    }
    if (SUBTYPES_DOCUMENT.includes(subtype)) {
      return 'document';
    }
    return subtype;
  }
}

module.exports = MimeTypeHelper;
