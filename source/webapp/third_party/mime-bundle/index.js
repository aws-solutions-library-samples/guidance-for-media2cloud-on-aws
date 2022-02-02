// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-undef */
const Mime = require('mime');

module.exports = {
  Mime,
};

global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    Mime,
  });
