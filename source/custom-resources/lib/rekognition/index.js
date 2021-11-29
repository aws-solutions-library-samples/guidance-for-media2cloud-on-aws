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
const {
  ServiceAvailability,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

/**
 * @function CreateFaceCollection
 * @param {object} event
 * @param {object} context
 */
exports.CreateFaceCollection = async (event, context) => {
  try {
    const x0 = new X0(event, context);
    const data = event.ResourceProperties.Data;
    if (!data.CollectionId) {
      throw new Error('CollectionId is undefined');
    }
    x0.storeResponseData('Id', data.CollectionId);

    /* make sure region supports rekognition */
    const supported = await ServiceAvailability.probe('rekognition').catch(() => false);
    if (!supported) {
      x0.storeResponseData('Arn', '');
      x0.storeResponseData('Status', 'SKIPPED');
      x0.storeResponseData('Reason', `rekognition not available in ${process.env.AWS_REGION} region`);
      return x0.responseData;
    }

    const params = {
      CollectionId: data.CollectionId,
    };

    const instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    if (x0.isRequestType('Create')) {
      const response = await instance.createCollection(params).promise().catch((e) => {
        if (e.code !== 'ResourceAlreadyExistsException') {
          throw e;
        }
      });
      x0.storeResponseData('Arn', response.CollectionArn);
    } else if (x0.isRequestType('Delete')) {
      await instance.deleteCollection(params).promise().catch((e) => {
        if (e.code !== 'ResourceNotFoundException') {
          throw e;
        }
      });
    }
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `CreateFaceCollection: ${e.message}`;
    throw e;
  }
};
