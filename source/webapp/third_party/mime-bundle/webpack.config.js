// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const webpack = require('webpack');
const PATH = require('path');

module.exports = {
  entry: [
    PATH.join(__dirname, 'index.js'),
  ],
  output: {
    path: __dirname,
    filename: 'mime.min.js',
  },
};
