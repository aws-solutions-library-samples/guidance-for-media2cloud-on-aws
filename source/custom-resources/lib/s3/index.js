// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  S3Client,
  PutBucketCorsCommand,
  PutBucketNotificationConfigurationCommand,
} = require('@aws-sdk/client-s3');
const {
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;
const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

class X0 extends mxBaseResponse(class {}) {}

/**
 * @function SetCORS
 * @param {object} event
 * @param {object} context
 */
exports.SetCORS = async (event, context) => {
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
    ].filter((x) =>
      data[x] === undefined);
    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PutBucketCorsCommand({
      Bucket: data.Bucket,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: data.AllowedOrigins,
            AllowedMethods: data.AllowedMethods,
            AllowedHeaders: data.AllowedHeaders,
            ExposeHeaders: data.ExposeHeaders,
            MaxAgeSeconds: Number(data.MaxAgeSeconds),
          },
        ],
      },
    });

    return s3Client.send(command)
      .then(() => {
        x0.storeResponseData('Status', 'SUCCESS');
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'SetCORS:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );
    throw e;
  }
};

exports.ConfigureBucketNotification = async (event, context) => {
  const x0 = new X0(event, context);
  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = {
      ...event.ResourceProperties.Data,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    };
    const missing = [
      'Bucket',
      'NotificationConfiguration',
    ].filter((x) =>
      data[x] === undefined);
    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PutBucketNotificationConfigurationCommand(data);
    return s3Client.send(command)
      .then(() => {
        x0.storeResponseData('Status', 'SUCCESS');
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'ConfigureBucketNotification:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );
    throw e;
  }
};
