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
      // version compatibility statement
      case 'CheckVersionCompatibilityStatement':
        handler = require('./lib/versionCompatibility').CheckVersionCompatibilityStatement;
        break;
      /* SNS */
      case 'EmailSubscribe':
        handler = require('./lib/sns/index').EmailSubscribe;
        break;
      /* Web */
      case 'CopyWebContent':
        handler = require('./lib/web/index').CopyWebContent;
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
      case 'CreateSolutionUuid':
        handler = require('./lib/solution').CreateSolutionUuid;
        break;
      case 'SendConfig':
        handler = require('./lib/solution').SendConfig;
        break;
      case 'CreateIndex':
        handler = require('./lib/elasticsearch').CreateIndex;
        break;
      /* cloudfront */
      case 'InvalidateCache':
        handler = require('./lib/cloudfront').InvalidateCache;
        break;
      /* neptune */
      case 'NeptuneDBCluster':
        handler = require('./lib/neptune').NeptuneDBCluster;
        break;
      case 'NeptuneDBInstance':
        handler = require('./lib/neptune').NeptuneDBInstance;
        break;
      // codebuild
      case 'StartBuild':
        handler = require('./lib/codebuild').StartBuild;
        break;
      case 'PostBuild':
        handler = require('./lib/codebuild').PostBuild;
        break;
      case 'StartBuildDelayResponse':
        handler = require('./lib/codebuild').StartBuildDelayResponse;
        break;
      // ecr
      case 'ECRDescribeImages':
        handler = require('./lib/ecr').ECRDescribeImages;
        break;
      default:
        break;
    }

    if (!handler) {
      throw Error(`${resource} not implemented`);
    }
    response = await handler(event, context);
    console.log(`response = ${JSON.stringify(response, null, 2)}`);

    // Workaround: for AWS::CloudFormation::WaitCondition not able to update stack
    // Delay response and let other resource such as CodeBuild to send the response.
    if (response.DELAYRESPONSE !== undefined
    && response.DELAYRESPONSE === '1') {
      return response;
    }

    return cfResponse.send(response);
  } catch (e) {
    console.error(e);
    return cfResponse.send(e);
  }
};
