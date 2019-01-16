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
  AnalyticsError,
} = require('./analyticsError');

/**
 * @function startAnalyticsStateMachine
 * @description function to start media-analysis-state-machine
 */
exports.startAnalyticsStateMachine = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));
    stateData.status = 'IN_PROGRESS';

    const {
      Data,
      Config,
      DataInTransit = {},
    } = event;

    const REQUIRED_DATA = [
      'requester',
      'AnalyticsBucket',
      'AnalyticsKey',
      'DurationInMs',
      'BeginTime',
    ];

    const missing = REQUIRED_DATA.filter(x => DataInTransit[x] === undefined);
    if (missing.length) {
      throw new AnalyticsError(`malformed input data, missing ${missing.join(', ')}`);
    }

    if (!Data || !Config) {
      throw new AnalyticsError('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;
    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    const {
      requester,
      AnalyticsKey,
    } = DataInTransit;

    const {
      base,
    } = PATH.parse(AnalyticsKey);

    const {
      invokedFunctionArn,
    } = context;

    const accountId = invokedFunctionArn.split(':')[4];

    const stateMachineArn = `arn:aws:states:${process.env.AWS_REGION}:${accountId}:stateMachine:${config.analyticsStateMachine}`;

    const mediaAnalysisSolutionParams = {
      Records: [{ eventSource: 'media-analysis' }],
      upload_time: new Date().toISOString(),
      key: AnalyticsKey,
      file_type: 'mp4',
      size: asset.proxy.contentLength,
      owner_id: requester,
      object_id: asset.uuid,
      file_name: base,
    };

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    process.env.ENV_QUIET || console.log(`startExecution.input = ${JSON.stringify(mediaAnalysisSolutionParams, null, 2)}`);

    const response = await step.startExecution({
      input: JSON.stringify(mediaAnalysisSolutionParams),
      stateMachineArn,
    }).promise();

    stateData.dataInTransit = response;
    /* restart the BeginTime */
    stateData.dataInTransit.BeginTime = (new Date()).getTime();

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(stateData.compact(), null, 2)}`);
    await bindIotPublish(stateData.compact());

    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(stateData.toJSON(), null, 2)}`);
    return stateData.toJSON();
  } catch (e) {
    try {
      if (bindIotPublish) {
        stateData.errorMessage = e;
        await bindIotPublish(stateData.compact());
      }
    } catch (e0) {
      /* do nothing */
    }
    process.env.ENV_QUIET || console.error(e);
    throw (e instanceof AnalyticsError) ? e : new AnalyticsError(e);
  }
};

/**
 * @function getAnalyticsStateMachine
 * @description function to poll media-analysis-state-machine status
 */
exports.getAnalyticsStateMachine = async (event) => {
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
      'DurationInMs',
      'BeginTime',
    ];

    const missing = REQUIRED_DATA.filter(x => DataInTransit[x] === undefined);
    if (missing.length) {
      throw new AnalyticsError(`malformed input data, missing ${missing.join(', ')}`);
    }

    if (!Data || !Config) {
      throw new AnalyticsError('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;

    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    const {
      executionArn,
      DurationInMs,
      BeginTime,
    } = DataInTransit;

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    const response = await step.describeExecution({
      executionArn,
    }).promise();

    const {
      status,
    } = response;

    stateData.status = StateIOData.normalizeStatus(status);

    /* assume analytics takes 2X of the time */
    const Tdiff = (new Date()).getTime() - Number.parseInt(BeginTime, 10);
    stateData.progress = Math.floor((Tdiff / (DurationInMs * 2)) * 100);

    if (stateData.status === 'FAILED') {
      throw new AnalyticsError(`media-analytics-solution state machine failed, ${status}`);
    }

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(stateData.compact(), null, 2)}`);
    await bindIotPublish(stateData.compact());

    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(stateData.toJSON(), null, 2)}`);
    return stateData.toJSON();
  } catch (e) {
    try {
      if (bindIotPublish) {
        stateData.errorMessage = e;
        await bindIotPublish(stateData.compact());
      }
    } catch (e0) {
      /* do nothing */
    }
    process.env.ENV_QUIET || console.error(e);
    throw (e instanceof AnalyticsError) ? e : new AnalyticsError(e);
  }
};

/**
 * @function collectAnalyticsResults
 * @description collect all ai/ml metadata results from media-analysis-state-machine
 */
exports.collectAnalyticsResults = async (event) => {
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
      'requester',
    ];

    const missing = REQUIRED_DATA.filter(x => DataInTransit[x] === undefined);
    if (missing.length) {
      throw new AnalyticsError(`malformed input data, missing ${missing.join(', ')}`);
    }

    if (!Data || !Config) {
      throw new AnalyticsError('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;

    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;
    stateData.status = 'COMPLETED';

    let {
      requester,
    } = DataInTransit;

    requester = decodeURIComponent(requester);

    /* delete the intermediate files created by media-analysis */
    const {
      name,
    } = PATH.parse(asset.proxy.key);

    const promises = [
      `${name}.mp4`,
      `${name}_audio.mp4`,
    ].map((x) => {
      const key = PATH.join('private', requester, 'media', asset.uuid, 'content', x);
      process.env.ENV_QUIET || console.log(`removing s3://${config.analyticsBucket}/${key}`);
      return VideoAsset.deleteObject(config.analyticsBucket, key);
    });

    const response = await Promise.all(promises);
    process.env.ENV_QUIET || console.log(`removed intermediate files = ${JSON.stringify(response, null, 2)}`);

    /* grab all the result json files */
    stateData.dataInTransit.AnalyticsPrefix = PATH.join('private', requester, 'media', asset.uuid, 'results');

    const fullData = stateData.toJSON();
    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(fullData, null, 2)}`);

    return fullData;
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
    throw (e instanceof AnalyticsError) ? e : new AnalyticsError(e);
  }
};
