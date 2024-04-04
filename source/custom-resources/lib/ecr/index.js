// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ECRClient,
  DescribeImagesCommand,
} = require('@aws-sdk/client-ecr');
const mxBaseResponse = require('../shared/mxBaseResponse');

const REGION = process.env.AWS_REGION;

const SUFFIX_REPO = 'RepositoryName';
const SUFFIX_TAG = 'ImageTag';
const SUFFIX_URI = 'ImageUri';
const SUFFIX_DIGEST = 'ImageDigest';

/**
 * @function ECRDescribeImages
 * @param {object} event
 * @param {object} context
 */
exports.ECRDescribeImages = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    // not handle Delete event
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data;
    const missing = [];

    const imageNames = Object.keys(data);
    imageNames.forEach((name) => {
      if (!data[name].registryId
      || !data[name].repositoryName
      || !((data[name].imageIds || [])[0] || {}).imageTag) {
        missing.push(`${name}.registryId, repositoryName, or imageTag`);
      }
    });

    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    const ecr = new ECRClient();

    for (let i = 0; i < imageNames.length; i += 1) {
      const name = imageNames[i];
      const item = data[name];

      const imageUri = `${name}${SUFFIX_URI}`;
      const imageDigest = `${name}${SUFFIX_DIGEST}`;
      const imageRepo = `${name}${SUFFIX_REPO}`;
      const imageTag = `${name}${SUFFIX_TAG}`;

      x0.storeResponseData(
        imageRepo,
        item.repositoryName
      );
      x0.storeResponseData(
        imageTag,
        item.imageIds[0].imageTag
      );

      const command = new DescribeImagesCommand(item);
      await ecr.send(command)
        .then((res) => {
          const detail = (res.imageDetails || [])[0] || {};
          if (detail.imageDigest) {
            x0.storeResponseData(
              imageDigest,
              detail.imageDigest
            );
            x0.storeResponseData(
              imageUri,
              `${detail.registryId}.dkr.ecr.${REGION}.amazonaws.com/${detail.repositoryName}:${detail.imageTags[0]}`
            );
          }
        })
        .catch(() => {
          x0.storeResponseData(imageUri, '');
          x0.storeResponseData(imageDigest, '');
        });
    }

    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    console.error(
      'ERR:',
      'ECR:',
      'DescribeImagesCommand:',
      (e.$metadata || {}).httpStatusCode || 500,
      e.name,
      e.message
    );
    throw e;
  }
};
