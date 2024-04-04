// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  IoTClient,
  DescribeEndpointCommand,
  ListTargetsForPolicyCommand,
  DetachPolicyCommand,
  InternalErrorException,
} = require('@aws-sdk/client-iot');
const {
  xraysdkHelper,
  retryStrategyHelper,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

/**
 * @function IotEndpoint
 * @param {object} event
 * @param {object} context
 */
exports.IotEndpoint = async (event, context) => {
  let x0;

  try {
    x0 = new X0(event, context);
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const iotClient = xraysdkHelper(new IoTClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DescribeEndpointCommand({
      endpointType: 'iot:Data-ATS',
    });

    return iotClient.send(command)
      .then((res) => {
        if (!(res || {}).endpointAddress) {
          throw new InternalErrorException('fail to get Iot endpoint');
        }
        x0.storeResponseData('Endpoint', res.endpointAddress);
        x0.storeResponseData('Status', 'SUCCESS');
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'IotEndpoint:',
      'DescribeEndpointCommand:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );
    throw e;
  }
};

/**
 * @function IotDetachPolices
 * @param {object} event
 * @param {object} context
 */
exports.IotDetachPolices = async (event, context) => {
  let command;
  let x0;

  try {
    x0 = new X0(event, context);
    if (x0.isRequestType('Create')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    if (!event.ResourceProperties.Data.IotThingPolicy) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const iotClient = xraysdkHelper(new IoTClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    command = new ListTargetsForPolicyCommand({
      policyName: event.ResourceProperties.Data.IotThingPolicy,
      pageSize: 200,
    });

    const targets = await iotClient.send(command)
      .then((res) =>
        res.targets || []);

    console.log(
      'targets',
      JSON.stringify(targets, null, 2)
    );

    if (targets && targets.length > 0) {
      await Promise.all(targets
        .map((target) => {
          command = new DetachPolicyCommand({
            policyName: event.ResourceProperties.Data.IotThingPolicy,
            target,
          });
          return iotClient.send(command)
            .catch((e) => {
              console.error(
                'ERR:',
                'IotDetachPolices:',
                'DetachPolicyCommand:',
                e.$metadata.httpStatusCode,
                e.name,
                target
              );
              return undefined;
            });
        }));
    }

    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    console.error(
      'ERR:',
      'IotDetachPolices:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );
    throw e;
  }
};
