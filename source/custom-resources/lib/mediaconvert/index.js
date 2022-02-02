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
 * @function MediaConvertEndpoint
 * @param {object} event
 * @param {object} context
 */
exports.MediaConvertEndpoint = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    /* not handle Delete event */
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const instance = new AWS.MediaConvert({
      apiVersion: '2017-08-29',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });

    const {
      Endpoints = [],
    } = await instance.describeEndpoints({
      MaxResults: 1,
    }).promise();

    /* sanity check the response */
    if (Endpoints.length === 0 || !Endpoints[0].Url) {
      throw new Error('failed to get endpoint');
    }

    x0.storeResponseData('Endpoint', Endpoints[0].Url);
    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `MediaConvertEndpoint: ${e.message}`;
    throw e;
  }
};
