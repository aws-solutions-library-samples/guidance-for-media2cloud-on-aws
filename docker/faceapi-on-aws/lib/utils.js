// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  join,
} = require('node:path');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || process.env.ENV_REGION;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;
const THRESHOLD_LAMBDA_TIMEOUT = 60 * 1000;

function lambdaTimeout(context = {}) {
  const { getRemainingTimeInMillis } = context;
  if (typeof getRemainingTimeInMillis !== 'function') {
    return false;
  }

  const remaining = getRemainingTimeInMillis();

  return (remaining - THRESHOLD_LAMBDA_TIMEOUT) <= 0;
}

function _getS3Client(region = REGION) {
  return new S3Client({
    region,
  });
}

async function download(bucket, key, bodyOnly = true, region = REGION) {
  const params = {
    Bucket: bucket,
    Key: key,
    ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
  };

  const s3Client = _getS3Client(region);
  const command = new GetObjectCommand(params);

  const promise = await s3Client.send(command)
    .then((res) => ({
      ...res,
      $metadata: undefined,
    }));

  if (bodyOnly) {
    return promise.Body.transformToString();
  }

  return promise;
}

async function upload(bucket, prefix, name, data, mime = 'application/json', region = REGION) {
  const params = {
    Bucket: bucket,
    Key: join(prefix, name),
    Body: data,
    ContentType: mime,
    ServerSideEncryption: 'AES256',
    ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
  };

  if (!(typeof data === 'string' || data instanceof Buffer)) {
    params.Body = JSON.stringify(data);
  }

  const s3Client = _getS3Client(region);

  const command = new PutObjectCommand(params);
  const promise = await s3Client.send(command)
    .then((res) => ({
      ...res,
      $metadata: undefined,
    }));

  return promise;
}

module.exports = {
  lambdaTimeout,
  download,
  upload,
};
