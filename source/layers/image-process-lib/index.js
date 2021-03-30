/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
const Jimp = require('jimp');
const Exiftool = require('./exiftool');

module.exports = {
  Jimp,
  Exiftool,
  ExiftoolConfig: Exiftool.GetConfiguration(),
};
