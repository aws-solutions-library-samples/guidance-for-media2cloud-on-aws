// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const Mime = require('mime');

const RAW_IMAGE_FORMATS = {
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

Mime.define(
  RAW_IMAGE_FORMATS,
  true
);

const TYPE_VIDEO = 'video';
const TYPE_AUDIO = 'audio';
const TYPE_IMAGE = 'image';
const TYPE_DOCUMENT = 'document';

const MAJOR_TYPES = [
  TYPE_VIDEO,
  TYPE_AUDIO,
  TYPE_IMAGE,
];

const VIDEO_SUBTYPES = [
  'mxf',
  'gxf',
];

const DOCUMENT_SUBTYPES = [
  'pdf',
];

function MimeGetMime(data) {
  if (typeof data === 'string') {
    return Mime.getType(data);
  }
  if ((data || {}).type) {
    return data.type;
  }
  if ((data || {}).mime) {
    return data.mime;
  }
  if ((data || {}).name) {
    return Mime.getType(data.name);
  }
  if ((data || {}).key) {
    return Mime.getType(data.key);
  }
  return undefined;
}

function MimeGetKind(data) {
  const mime = MimeGetMime(data) || '';
  const types = mime
    .split('/')
    .filter((x) =>
      x)
    .map((x) =>
      x.toLowerCase());

  if (MAJOR_TYPES.includes(types[0])) {
    return types[0];
  }
  if (VIDEO_SUBTYPES.includes(types[1])) {
    return TYPE_VIDEO;
  }
  if (DOCUMENT_SUBTYPES.includes(types[1])) {
    return TYPE_DOCUMENT;
  }

  return types[1];
}

window.MimeWrapper = {
  MimeGetMime,
  MimeGetKind,
  Mime,
};
