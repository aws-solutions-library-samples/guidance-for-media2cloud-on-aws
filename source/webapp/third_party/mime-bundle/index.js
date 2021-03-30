/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
const Mime = require('mime');

/**
 * This file is to wrap MIME library into browserify package
 */
module.exports = {
  Mime,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    Mime,
  });
