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
    filename: 'aws-sdk-js-v3.min.js',
  },
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
      url: require.resolve('url'),
      util: require.resolve('util'),
      buffer: require.resolve('buffer/'),
      'process/browser': require.resolve('process/browser'),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: [
        'buffer',
        'Buffer',
      ],
    }),
  ],
};
