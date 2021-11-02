// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const Jimp = require('jimp');
const Exiftool = require('./exiftool');

module.exports = {
  Jimp,
  Exiftool,
  ExiftoolConfig: Exiftool.GetConfiguration(),
};
