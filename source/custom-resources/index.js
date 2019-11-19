/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
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
    switch (FunctionName) {
      /* SNS */
      case 'EmailSubscribe':
        handler = require('./lib/sns/index').EmailSubscribe;
        break;
      /* Web */
      case 'CopyWebContent':
        handler = require('./lib/web/index').CopyWebContent;
        break;
      case 'UpdateManifest':
        handler = require('./lib/web/index').UpdateManifest;
        break;
      /* S3 */
      case 'CheckBucketAvailability':
        handler = require('./lib/s3/index').CheckBucketAvailability;
        break;
      case 'SetNotification':
        handler = require('./lib/s3/index').SetNotification;
        break;
      case 'SetCORS':
        handler = require('./lib/s3/index').SetCORS;
        break;
      case 'SetLifecyclePolicy':
        handler = require('./lib/s3/index').SetLifecyclePolicy;
        break;
      /* string */
      case 'StringManipulation':
        handler = require('./lib/string/index').StringManipulation;
        break;
      /* mediaconvert */
      case 'MediaConvertEndpoint':
        handler = require('./lib/mediaconvert/index').MediaConvertEndpoint;
        break;
      /* iot */
      case 'IotEndpoint':
        handler = require('./lib/iot/index').IotEndpoint;
        break;
      case 'IotDetachPolices':
        handler = require('./lib/iot/index').IotDetachPolices;
        break;
      /* cognito */
      case 'RegisterUser':
        handler = require('./lib/cognito/index').RegisterUser;
        break;
      /* sagemaker */
      case 'ConfigureWorkteam':
        handler = require('./lib/groundTruth/index').ConfigureWorkteam;
        break;
      /* rekognition */
      case 'CreateFaceCollection':
        handler = require('./lib/rekognition').CreateFaceCollection;
        break;
      case 'CreateCustomVocabulary':
        handler = require('./lib/transcribe').CreateCustomVocabulary;
        break;
      case 'CreateSolutionUuid':
        handler = require('./lib/solution').CreateSolutionUuid;
        break;
      case 'SendConfig':
        handler = require('./lib/solution').SendConfig;
        break;
      case 'CreateIndex':
        handler = require('./lib/elasticsearch').CreateIndex;
        break;
      default:
        break;
    }

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
