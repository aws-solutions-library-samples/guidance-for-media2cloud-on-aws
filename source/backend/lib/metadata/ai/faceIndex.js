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
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-vars */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');
const PATH = require('path');

const {
  VideoAsset,
  DBConfig,
  IotStatus,
  StateIOData,
} = require('../../common');

const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

/**
 * @class FaceIndexError
 */
class FaceIndexError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, FaceIndexError);
  }
}

/**
 * Face Index State Machine
 */
exports.startFaceIndexStateMachine = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));

    stateData.service = 'aws.states';
    stateData.state = 'index';
    stateData.status = 'STARTED';
    stateData.progress = 1;

    const {
      Data,
      Config,
      DataInTransit = {},
    } = event;

    const REQUIRED_DATA = [
      'requester',
      'FaceBucket',
      'FaceKey',
    ];

    const missing = REQUIRED_DATA.filter(x => DataInTransit[x] === undefined);
    if (missing.length) {
      throw new FaceIndexError(`malformed input data, missing ${missing.join(', ')}`);
    }

    if (!Data || !Config) {
      throw new FaceIndexError('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;
    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    const {
      requester,
      FaceBucket,
      FaceKey,
    } = DataInTransit;

    const {
      base,
      ext,
    } = PATH.parse(FaceKey);

    /* grab the image size */
    const {
      ContentLength: imageSize,
    } = X.headObject(FaceBucket, FaceKey);

    // arn:aws:lambda:region:account-id:function:function-name
    const {
      invokedFunctionArn,
    } = context;

    const accountId = invokedFunctionArn.split(':')[4];

    // arn:aws:states:eu-west-1:xxx:stateMachine:media-analysis-state-machine
    const stateMachineArn = `arn:aws:states:${process.env.AWS_REGION}:${accountId}:stateMachine:${config.analyticsStateMachine}`;

    const mediaAnalysisSolutionParams = {
      Records: [{
        eventSource: 'media-analysis',
      }],
      upload_time: new Date().toISOString(),
      key: FaceKey,
      file_type: ext.slice(1),
      size: imageSize,
      owner_id: requester,
      object_id: asset.uuid,
      file_name: base,
    };

    process.env.ENV_QUIET || console.log(`startExecution.input = ${JSON.stringify(mediaAnalysisSolutionParams, null, 2)}`);

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    const response = await step.startExecution({
      input: JSON.stringify(mediaAnalysisSolutionParams),
      stateMachineArn,
    }).promise();
    stateData.dataInTransit = response;

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(stateData.compact(), null, 2)}`);
    await bindIotPublish(stateData.compact());

    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(stateData.toJSON(), null, 2)}`);
    return stateData.toJSON();
  } catch (e) {
    try {
      process.env.ENV_QUIET || console.error(e);
      stateData.errorMessage = e;
      if (bindIotPublish) {
        await bindIotPublish(stateData.compact());
      }
    } catch (e0) {
      /* do nothing */
    }
    throw (e instanceof FaceIndexError) ? e : new FaceIndexError(e);
  }
};

exports.getFaceIndexStateMachine = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));
    const {
      Data,
      Config,
      DataInTransit = {},
    } = event;

    const REQUIRED_DATA = [
      'executionArn',
    ];

    const missing = REQUIRED_DATA.filter(x => DataInTransit[x] === undefined);
    if (missing.length) {
      throw new FaceIndexError(`malformed input data, missing ${missing.join(', ')}`);
    }

    if (!Data || !Config) {
      throw new FaceIndexError('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;

    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;
    stateData.progress += 5;

    const {
      executionArn,
    } = DataInTransit;

    const step = new AWS.StepFunctions({ apiVersion: '2016-11-23' });

    const response = await step.describeExecution({
      executionArn,
    }).promise();

    const {
      status,
    } = response;

    stateData.status = StateIOData.normalizeStatus(status);
    if (stateData.status === 'FAILED') {
      throw new FaceIndexError(`media-analytics-solution state machine failed, ${status}`);
    }

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(stateData.compact(), null, 2)}`);
    await bindIotPublish(stateData.compact());

    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(stateData.toJSON(), null, 2)}`);
    return stateData.toJSON();
  } catch (e) {
    try {
      process.env.ENV_QUIET || console.error(e);
      stateData.errorMessage = e;
      if (bindIotPublish) {
        await bindIotPublish(stateData.compact());
      }
    } catch (e0) {
      /* do nothing */
    }
    throw (e instanceof FaceIndexError) ? e : new FaceIndexError(e);
  }
};

exports.faceIndexStateMachineCompleted = async (event, context) => {
  process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));
  return event;
};

async function ensureCollectionExits(instance, CollectionId) {
  try {
    await instance.createCollection({
      CollectionId,
    }).promise();
  } catch (e) {
    if (e.code !== 'ResourceAlreadyExistsException') {
      throw e;
    }
  }
}

exports.indexFace = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));
    stateData.service = 'aws.states';
    stateData.state = 'index';
    stateData.status = 'STARTED';
    stateData.progress = 1;

    const {
      Data,
      Config,
      DataInTransit = {},
    } = event;

    const REQUIRED_DATA = [
      'requester',
      'FaceBucket',
      'FaceKey',
      'FaceId',
    ];

    const missing = REQUIRED_DATA.filter(x => DataInTransit[x] === undefined);
    if (missing.length) {
      throw new FaceIndexError(`malformed input data, missing ${missing.join(', ')}`);
    }

    if (!Data || !Config) {
      throw new FaceIndexError('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;
    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    const {
      requester,
      FaceBucket,
      FaceKey,
      FaceId,
    } = DataInTransit;

    const CollectionId = decodeURIComponent(requester).replace(':', '-');

    /* try to create the collection */
    const instance = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });

    await ensureCollectionExits(instance, CollectionId);

    const params = {
      CollectionId,
      DetectionAttributes: ['ALL'],
      ExternalImageId: FaceId,
      Image: {
        S3Object: {
          Bucket: FaceBucket,
          Name: FaceKey,
        },
      },
    };

    const response = await instance.indexFaces(params).promise();
    process.env.ENV_QUIET || console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    /* do nothing */
    process.env.ENV_QUIET || console.error(e);
  }
};
