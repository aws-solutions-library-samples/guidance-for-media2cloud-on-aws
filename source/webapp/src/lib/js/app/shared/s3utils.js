// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import {
  GetUserSession,
  RegisterUserSessionEvent,
  SESSION_SIGNIN,
  SESSION_SIGNOUT,
  SESSION_TOKEN_REFRESHED,
} from './cognito/userSession.js';
import AppUtils from './appUtils.js';

const {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  Upload,
  getSignedUrl,
} = window.AWSv3;

const {
  Region,
  S3: {
    ExpectedBucketOwner,
  },
  Ingest: {
    Bucket: IngestBucket,
  },
  Proxy: {
    Bucket: ProxyBucket,
  },
} = SolutionManifest;

const EXPIRES_IN = 3600 * 2;
const MAX_CONCURRENT_UPLOAD = 4;
const MULTIPART_SIZE = 8 * 1024 * 1024;

let _s3Client;

function updateClient(userSession) {
  _s3Client = new S3Client({
    region: Region,
    credentials: userSession.fromCredentials(),
    // Workaround for data integrity check that fails the multipart upload:
    // https://github.com/aws/aws-sdk-js-v3/issues/6810
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

async function onUserSessionChangeEvent(event, session) {
  if (event === SESSION_SIGNIN
  || event === SESSION_TOKEN_REFRESHED) {
    updateClient(session);
  }
}

RegisterUserSessionEvent(
  's3utils',
  onUserSessionChangeEvent.bind(this)
);

/* singleton implementation */
let _singleton;

class S3Utils {
  constructor() {
    _singleton = this;
    this.$id = AppUtils.randomHexstring();
  }

  get id() {
    return this.$id;
  }

  async signUrl(
    bucket,
    key
  ) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(
      _s3Client,
      command,
      {
        expiresIn: EXPIRES_IN,
      }
    );
  }

  async headObject(
    bucket,
    key
  ) {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner,
    });

    return _s3Client.send(command)
      .then((res) => {
        delete res.$metadata;
        return res;
      });
  }

  async getObject(
    bucket,
    key
  ) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner,
    });

    return _s3Client.send(command)
      .then((res) => {
        delete res.$metadata;
        return res;
      });
  }

  async listObjects(
    bucket,
    prefix
  ) {
    let collection = [];
    let response;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 100,
        ContinuationToken: (response || {}).NextContinuationToken,
        ExpectedBucketOwner,
      });

      response = await _s3Client.send(command);

      collection = collection.concat(response.Contents);
    } while ((response || {}).NextContinuationToken);

    return collection;
  }

  async deleteObject(
    bucket,
    key
  ) {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner,
    });

    return _s3Client.send(command)
      .then((res) => {
        delete res.$metadata;
        return res;
      });
  }

  async upload(
    params,
    fn
  ) {
    const multipartUpload = new Upload({
      client: _s3Client,
      params: {
        ...params,
        ExpectedBucketOwner,
      },
      queueSize: MAX_CONCURRENT_UPLOAD,
      partSize: MULTIPART_SIZE,
      leavePartsOnError: false,
    });

    multipartUpload.on('httpUploadProgress', (data) => {
      if (typeof fn === 'function') {
        fn(data);
      } else {
        console.log(
          'INFO:',
          'httpUploadProgress:',
          data,
          `(${params.Key})`
        );
      }
    });

    return multipartUpload.done();
  }
}

const GetS3Utils = () => {
  if (_singleton === undefined) {
    const notused_ = new S3Utils();

    const session = GetUserSession();
    updateClient(session);
  }

  return _singleton;
};

const GetBucketRegion = () =>
  Region;

const GetProxyBucket = () =>
  ProxyBucket;

const GetIngestBucket = () =>
  IngestBucket;

export {
  GetBucketRegion,
  GetProxyBucket,
  GetIngestBucket,
  GetS3Utils,
};
