// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

/* eslint-disable no-undef */
const Mime = require('mime');

module.exports = {
  Mime,
};

global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    Mime,
  });
