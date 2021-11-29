// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const mxBaseResponse = require('../shared/mxBaseResponse');

const ExpectedBucketOwner = process.env.ENV_EXPECTED_BUCKET_OWNER;

/**
 * @function SetCORS
 * @param {object} event
 * @param {object} context
 */
exports.SetCORS = async (event, context) => {
  class X0 extends mxBaseResponse(class {}) {}
  const x0 = new X0(event, context);
  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data;
    const missing = [
      'Bucket',
      'AllowedOrigins',
      'AllowedMethods',
      'AllowedHeaders',
      'ExposeHeaders',
      'MaxAgeSeconds',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    await s3.putBucketCors({
      Bucket: data.Bucket,
      ExpectedBucketOwner,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: data.AllowedOrigins,
            AllowedMethods: data.AllowedMethods,
            AllowedHeaders: data.AllowedHeaders,
            ExposeHeaders: data.ExposeHeaders,
            MaxAgeSeconds: Number.parseInt(data.MaxAgeSeconds, 10),
          },
        ],
      },
    }).promise();
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `SetCORS: ${e.code} ${e.message}`;
    throw e;
  }
};

exports.ConfigureBucketNotification = async (event, context) => {
  class X0 extends mxBaseResponse(class {}) {}
  const x0 = new X0(event, context);
  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = {
      ...event.ResourceProperties.Data,
      ExpectedBucketOwner,
    };
    const missing = [
      'Bucket',
      'NotificationConfiguration',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    await s3.putBucketNotificationConfiguration(data)
      .promise()
      .then((res) =>
        console.log(JSON.stringify(res, null, 2)));
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `ConfigureBucketNotification: ${e.code} ${e.message}`;
    throw e;
  }
};
