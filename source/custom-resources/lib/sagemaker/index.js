// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const mxBaseResponse = require('../shared/mxBaseResponse');

/**
 * @function DescribeSageMakerEndpoint
 * @param {object} event
 * @param {object} context
 */
exports.DescribeSageMakerEndpoint = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    /* not handle Delete event */
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data;
    if (!data.EndpointName) {
      throw new Error('missing EndpointName');
    }

    const sagemaker = new AWS.SageMaker({
      apiVersion: '2017-07-24',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });

    const response = await sagemaker.describeEndpoint({
      EndpointName: data.EndpointName,
    }).promise();

    if (!response.EndpointArn) {
      throw new Error('invalid model EndpointArn');
    }
    if (!response.EndpointStatus) {
      throw new Error('invalid model EndpointStatus');
    }

    x0.storeResponseData('EndpointName', response.EndpointName);
    x0.storeResponseData('EndpointArn', response.EndpointArn);
    x0.storeResponseData('EndpointStatus', response.EndpointStatus);
    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `DescribeSageMakerEndpoint: ${e.message}`;
    throw e;
  }
};
