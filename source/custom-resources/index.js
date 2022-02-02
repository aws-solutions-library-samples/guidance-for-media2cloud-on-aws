// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const CloudFormationResponse = require('./lib/shared/cfResponse');

exports.handler = async (event, context) => {
  console.log(`\nconst event = ${JSON.stringify(event, null, 2)};\nconst context = ${JSON.stringify(context, null, 2)}`);

  const cfResponse = new CloudFormationResponse(event, context);
  let response;

  try {
    const resource = event.ResourceType.split(':').pop();
    let handler;
    switch (resource) {
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
      case 'CreateSolutionManifest':
        handler = require('./lib/web/index').UpdateManifest;
        break;
      /* S3 */
      case 'SetCORS':
        handler = require('./lib/s3/index').SetCORS;
        break;
      case 'ConfigureBucketNotification':
        handler = require('./lib/s3/index').ConfigureBucketNotification;
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
      case 'CreatePipeline':
        handler = require('./lib/elastictranscoder').CreatePipeline;
        break;
      /* cloudfront */
      case 'InvalidateCache':
        handler = require('./lib/cloudfront').InvalidateCache;
        break;
      default:
        break;
    }

    if (!handler) {
      throw Error(`${resource} not implemented`);
    }
    response = await handler(event, context);
    console.log(`response = ${JSON.stringify(response, null, 2)}`);

    return cfResponse.send(response);
  } catch (e) {
    console.error(e);
    return cfResponse.send(e);
  }
};
