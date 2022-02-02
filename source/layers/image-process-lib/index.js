// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const Jimp = require('jimp');
const Exiftool = require('./exiftool');

/**
 * WORKAROUND: JIMP 0.16.1 (0.9.6 doesn't have the issue.)
 * jpeg-js decoder throws an error when maxMemoryUsageInMB > 512
 * Reference: https://github.com/oliver-moran/jimp/issues/915
 */
const JpegDecoder = Jimp.decoders['image/jpeg'];
Jimp.decoders['image/jpeg'] = (data) =>
  JpegDecoder(data, {
    maxResolutionInMP: 200,
    maxMemoryUsageInMB: 2048,
  });

module.exports = {
  Jimp,
  Exiftool,
  ExiftoolConfig: Exiftool.GetConfiguration(),
};
