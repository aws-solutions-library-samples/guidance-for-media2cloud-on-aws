// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';

export default class S3Utils {
  static get Constants() {
    return {
      Expiration: 60 * 60 * 2,
    };
  }

  static getInstance(params) {
    return new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      useAccelerateEndpoint: !!((SolutionManifest.S3 || {}).UseAccelerateEndpoint),
      customUserAgent: SolutionManifest.CustomUserAgent,
      ...params,
    });
  }

  static signUrl(bucket, key) {
    return S3Utils.getInstance().getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: S3Utils.Constants.Expiration,
    });
  }

  static async getObject(bucket, key) {
    return S3Utils.getInstance().getObject({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: SolutionManifest.S3.ExpectedBucketOwner,
    }).promise();
  }

  static async listObjects(bucket, prefix) {
    const collection = [];
    const s3 = S3Utils.getInstance();
    let response;
    do {
      response = await s3.listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 100,
        ContinuationToken: (response || {}).NextContinuationToken,
        ExpectedBucketOwner: SolutionManifest.S3.ExpectedBucketOwner,
      }).promise();
      collection.splice(collection.length, 0, ...response.Contents);
    } while ((response || {}).NextContinuationToken);
    return collection;
  }

  static async upload(bucket, key, data, mime) {
    return S3Utils.getInstance().upload({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: mime,
      ExpectedBucketOwner: SolutionManifest.S3.ExpectedBucketOwner,
    }).promise();
  }

  static async deleteObject(bucket, key) {
    return S3Utils.getInstance().deleteObject({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: SolutionManifest.S3.ExpectedBucketOwner,
    }).promise();
  }
}
