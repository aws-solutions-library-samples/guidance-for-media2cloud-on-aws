/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

const AWS = require('aws-sdk-mock');

const {
  assert,
} = require('chai');

const {
  onRequest,
} = require('./index');

const {
  requestBody,
} = require('./fixtures/requestBody');

const {
  mxCommonUtils,
} = require('../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

/* test event */
const event = {
  resource: '/{operation}',
  path: '/ingest-statemachine',
  httpMethod: 'POST',
  headers: {
    'X-Forwarded-For': '0.0.0.0, 1.1.1.1',
  },
  queryStringParameters: null,
  pathParameters: {
    operation: 'ingest-statemachine',
  },
  requestContext: {
    identity: {
      cognitoIdentityId: 'eu-west-1:0000',
    },
  },
  body: JSON.stringify(requestBody),
  isBase64Encoded: false,
};

/* test context */
const context = {
  invokedFunctionArn: `arn:aws:lambda:region:${X.zeroAccountId()}:function:mock-function`,
};

describe('api-gateway', async function () {
  /* mock response from startExecution */
  const responseStartExecution = {
    executionArn: `arn:aws:states:region:${X.zeroAccountId()}:execution:ingest-statemachine:${X.zeroUUID()}`,
    startDate: new Date().getTime(),
  };

  describe('#/start-statemachine', async function () {
    AWS.mock('StepFunctions', 'startExecution', function (_, callback) {
      callback(null, responseStartExecution);
    });

    it('should return 200 statusCode', async function () {
      const response = await onRequest(event, context);
      assert.equal(Number.parseInt(response.statusCode, 10), 200);
    });
  });

  describe('#/attach-iot-policy', async function () {
    AWS.mock('Iot', 'attachPolicy', function (_, callback) {
      callback(null, {});
    });

    it('should return 200 statusCode', async function () {
      process.env.ENV_IOT_THING_POLICY_NAME = 'mock-policy';
      event.pathParameters.operation = 'attach-iot-policy';

      const response = await onRequest(event, context);
      assert.equal(Number.parseInt(response.statusCode, 10), 200);
    });
  });
});
