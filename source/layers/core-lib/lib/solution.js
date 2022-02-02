// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const FS = require('fs');
const PATH = require('path');

const version = FS.readFileSync(PATH.join(__dirname, '.version')).toString().trim();
module.exports = {
  Id: 'so0050',
  Name: 'media2cloud',
  Version: version,
};
