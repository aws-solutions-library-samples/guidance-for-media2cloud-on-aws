// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const FS = require('fs');
const PATH = require('path');

const version = FS.readFileSync(PATH.join(__dirname, '.version')).toString().trim();
module.exports = {
  Id: 'so0050',
  Name: 'media2cloud',
  Version: version,
};
