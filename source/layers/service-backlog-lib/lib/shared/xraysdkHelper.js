// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

function xraysdkHelper(client) {
  let wrappedClient = client;

  if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
    return wrappedClient;
  }

  try {
    const {
      captureAWSv3Client,
    } = require('aws-xray-sdk-core');

    wrappedClient = captureAWSv3Client(wrappedClient);
  } catch (e) {
    console.log('aws-xray-sdk-core not loaded');
  }

  return wrappedClient;
}

module.exports = xraysdkHelper;
