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
  AnalyticsError,
} = require('../analytics/analyticsError');

/**
 * @function copyObjectForAnalytics
 * @description function to copy object to media-analytics-solution folder
 */
exports.copyObjectForAnalytics = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));

    stateData.service = 'aws.states';
    stateData.state = 'analytics';
    stateData.status = 'STARTED';

    const {
      Data,
      Config,
      DataInTransit = {},
    } = event;

    const {
      requester,
    } = DataInTransit;

    if (!Data || !Config) {
      throw new AnalyticsError('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.stateMachine = config.metadataStateMachine;
    stateData.config = config;

    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    /* send message to IoT letting web app knows we are starting */
    process.env.ENV_QUIET || console.log(`mqttPayload.STARTED = ${JSON.stringify(stateData.compact(), null, 2)}`);
    let promiseIot = await bindIotPublish(stateData.compact());

    if (!requester) {
      throw new AnalyticsError('malformed input data, DataInTransit.requester not found');
    }

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const readableStream = s3.getObject({
      Bucket: asset.proxy.bucket,
      Key: asset.proxy.key,
    }).createReadStream();

    const {
      base,
    } = PATH.parse(asset.proxy.key);

    const options = {
      partSize: 8 * 1024 * 1024,
      queueSize: 10,
    };

    const Key = PATH.join('private', decodeURIComponent(requester), 'media', asset.uuid, 'content', base);

    const manager = await s3.upload({
      Bucket: config.analyticsBucket,
      Key,
      Body: readableStream,
    }, options);

    manager.on('httpUploadProgress', (progress) => {
      const {
        loaded,
        total,
      } = progress;

      const percentage = Math.ceil((loaded / total) * 100);

      if (percentage === 100) {
        process.env.ENV_QUIET || console.log(`httpUploadProgress = ${percentage}%`);
      }
    });

    const response = await manager.promise();
    process.env.ENV_QUIET || console.log(`upload.response = ${JSON.stringify(response)}`);

    /* load mediainfo to get file Duration */
    const mediainfo =
      await asset.fetchMediainfo(config.mediainfoTable, config.mediainfoPartitionKey);

    const {
      container: {
        duration: DurationInMs,
      },
    } = mediainfo;

    /* update stateData */
    stateData.progress = 0;
    stateData.dataInTransit = {
      requester,
      AnalyticsBucket: config.analyticsBucket,
      AnalyticsKey: Key,
      DurationInMs,
      BeginTime: (new Date()).getTime(),
    };

    /* send message to IoT */
    /* make sure the previous IoT message has been sent */
    await promiseIot;

    const compactData = stateData.compact();
    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(compactData, null, 2)}`);

    promiseIot = bindIotPublish(stateData.compact());

    const fullData = stateData.toJSON();
    process.env.ENV_QUIET || console.log(`responseData = ${JSON.stringify(fullData, null, 2)}`);

    await Promise.all([promiseIot]);

    return fullData;
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
