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

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const {
  Lambda,
} = require('aws-sdk');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

const REQUIRED_PROPERTIES = [
  'ServiceToken',
  'FunctionName',
  'ConfigurationTableName',
  'ConfigurationPartitionKey',
  'ConfigurationItemName',
  'LambdaFunctionList',
  'SNSTopicArn',
];

/**
 * @function UpdateLambdaEnvironment
 * @param {object} event
 * @param {object} context
 */
exports.UpdateLambdaEnvironment = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const {
      ResourceProperties: Props = {},
    } = event || {};

    /* sanity check */
    const missing = REQUIRED_PROPERTIES.filter(x => Props[x] === undefined);
    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    const Environment = {
      Variables: {
        ENV_CONFIGURATION_TALBE: Props.ConfigurationTableName,
        ENV_CONFIGURATION_PARTITION_KEY: Props.ConfigurationPartitionKey,
        ENV_CONFIGURATION_ITEM_NAME: Props.ConfigurationItemName,
        ENV_SNS_TOPIC_ARN: Props.SNSTopicArn,
      },
    };

    const lambdas = Props.LambdaFunctionList.split(',').filter(x => x).map(x => x.trim());

    const promises = lambdas.map((FunctionName) => {
      console.log(`updating ${FunctionName}...`);
      const instance = new Lambda({ apiVersion: '2015-03-31' });
      const params = {
        FunctionName,
        Environment,
      };

      return instance.updateFunctionConfiguration(params).promise();
    });

    const result = await Promise.all(promises);

    console.log(JSON.stringify(result, null, 2));

    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `UpdateLambdaEnvironment: ${e.message}`;
    throw e;
  }
};
