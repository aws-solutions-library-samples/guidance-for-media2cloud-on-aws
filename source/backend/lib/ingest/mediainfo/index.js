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
/* eslint-disable no-unused-vars */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const {
  MediaInfoCommand,
} = require('./mediaInfoCommand');

const {
  DBConfig,
  VideoAsset,
  IotStatus,
  StateIOData,
} = require('../../common');

/**
 * @function generateMediaInfo
 * @description call mediainfo command to get media info
 * @param {object} event
 * @param {object} [context]
 */
exports.generateMediaInfo = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData({
    State: 'mediainfo',
    Status: 'STARTED',
  });

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));
    const {
      Config,
      Data,
    } = event;

    const config = new DBConfig(Config);
    stateData.stateMachine = config.ingestStateMachine;
    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);
    stateData.config = config;

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    const instance = new MediaInfoCommand();
    const metadata = await instance.analyze({
      Bucket: asset.glacier.bucket,
      Key: asset.glacier.videoKey,
    });
    process.env.ENV_QUIET || console.log(`metadata = ${JSON.stringify(metadata, null, 2)}`);

    delete metadata.filename;
    await asset.updateMediainfoDB(config.mediainfoTable, config.mediainfoPartitionKey, metadata);

    stateData.dataInTransit = metadata;
    stateData.status = 'COMPLETED';

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
    throw e;
  }
};
