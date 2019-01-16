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

const {
  CloudFormationResponse,
} = require('./lib/shared/cfResponse');


/**
 * @function Run
 * @description entrypoint to delegate to service's specific functions.
 * @param {object} event
 * @param {object} context
 */
exports.Run = async (event, context) => {
  console.log(`\nconst event = ${JSON.stringify(event, null, 2)};\nconst context = ${JSON.stringify(context, null, 2)}`);

  const cfResponse = new CloudFormationResponse(event, context);

  let response;

  try {
    const {
      FunctionName,
    } = (event || {}).ResourceProperties || {};

    let handler;

    if (FunctionName === 'EmailSubscribe') {
      /* SNS */
      handler = require('./lib/sns/index').EmailSubscribe;
    } else if (FunctionName === 'CopyWebContent') {
      /* Web CopyWebContent */
      handler = require('./lib/web/index').CopyWebContent;
    } else if (FunctionName === 'UpdateManifest') {
      /* Web UpdateManifest */
      handler = require('./lib/web/index').UpdateManifest;
    } else if (FunctionName === 'SetNotification') {
      /* S3 Notification */
      handler = require('./lib/s3/index').SetNotification;
    } else if (FunctionName === 'SetCORS') {
      /* S3 CORS */
      handler = require('./lib/s3/index').SetCORS;
    } else if (FunctionName === 'SetLifecyclePolicy') {
      /* S3 Lifecycle policy */
      handler = require('./lib/s3/index').SetLifecyclePolicy;
    } else if (FunctionName === 'StringManipulation') {
      /* String */
      handler = require('./lib/string/index').StringManipulation;
    } else if (FunctionName === 'MediaConvertEndpoint') {
      /* MediaConvert */
      handler = require('./lib/mediaconvert/index').MediaConvertEndpoint;
    } else if (FunctionName === 'IotEndpoint') {
      /* Iot */
      handler = require('./lib/iot/index').IotEndpoint;
    } else if (FunctionName === 'IotDetachPolices') {
      /* Iot */
      handler = require('./lib/iot/index').IotDetachPolices;
    } else if (FunctionName === 'InitializeDB') {
      /* DynamoDB */
      handler = require('./lib/dynamodb/index').InitializeDB;
    } else if (FunctionName === 'UpdateLambdaEnvironment') {
      /* Lambda */
      handler = require('./lib/lambda/index').UpdateLambdaEnvironment;
    }
    /* other services go here */

    if (!handler) {
      throw Error(`${FunctionName} not implemented`);
    }

    response = await handler(event, context);
    console.log(`response = ${JSON.stringify(response, null, 2)}`);

    response = await cfResponse.send(response);

    return response;
  } catch (e) {
    console.error(e);
    response = await cfResponse.send(e);

    return response;
  }
};
