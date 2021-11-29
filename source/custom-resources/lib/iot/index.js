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

/**
 * @function IotEndpoint
 * @param {object} event
 * @param {object} context
 */
exports.IotEndpoint = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const iot = new AWS.Iot({
      apiVersion: '2015-05-28',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    const response = await iot.describeEndpoint({
      endpointType: 'iot:Data-ATS',
    }).promise();

    if (!(response || {}).endpointAddress) {
      throw new Error('fail to get Iot endpoint');
    }
    x0.storeResponseData('Endpoint', response.endpointAddress);
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `IotEndpoint: ${e.message}`;
    throw e;
  }
};

/**
 * @function IotDetachPolices
 * @param {object} event
 * @param {object} context
 */
exports.IotDetachPolices = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Create')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    if (!event.ResourceProperties.Data.IotThingPolicy) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const iot = new AWS.Iot({
      apiVersion: '2015-05-28',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    const {
      targets = [],
    } = await iot.listTargetsForPolicy({
      policyName: event.ResourceProperties.Data.IotThingPolicy,
      pageSize: 200,
    }).promise();
    console.log(JSON.stringify(targets, null, 2));

    const response = await Promise.all(targets.map(target =>
      iot.detachPolicy({
        policyName: event.ResourceProperties.Data.IotThingPolicy,
        target,
      }).promise()));
    console.log(JSON.stringify(response, null, 2));

    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `IotDetachPolices: ${e.message}`;
    throw e;
  }
};
