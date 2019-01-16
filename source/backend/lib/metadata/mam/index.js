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
const PATH = require('path');

const {
  VideoAsset,
  DBConfig,
  IotStatus,
  StateIOData,
} = require('../../common');

const {
  send: PublishSNS,
} = require('../../sns/index');

const {
  Celebrities,
  Emotions,
  Labels,
  KeyPhrases,
  Locations,
  Persons,
} = require('../analytics/parser');

/**
 * @function dispatchEvent
 * @description dispatch message to SNS topic to notify MAM and/or downstream workflow
 * @param {object} event
 */
exports.dispatchEvent = async (event) => {
  let bindIotPublish = null;
  const stateData = new StateIOData(event);

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));

    stateData.state = 'mam';
    stateData.status = 'IN_PROGRESS';
    stateData.progress = 1;

    const {
      Data,
      Config,
    } = event;

    if (!Data || !Config) {
      throw new Error('malformed input data, Data or Config not found');
    }

    const config = new DBConfig(Config);
    stateData.config = config;

    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);

    const asset = new VideoAsset(Data);
    stateData.data = asset;

    /* send a message to web client when we are about to start */
    await bindIotPublish(stateData.compact());

    /* fetch mediainfo for duration */
    const mediainfo =
    await asset.fetchMediainfo(config.mediainfoTable, config.mediainfoPartitionKey);

    /* load metadata keys */
    const metaMachine = asset.machineMetadata;
    await metaMachine.loadMetaTracks();

    let instance;

    /* eslint-disable prefer-destructuring */
    instance = new Celebrities(metaMachine);
    const celebrities = await instance.parse();

    instance = new Emotions(metaMachine);
    const emotions = await instance.parse();

    instance = new Labels(metaMachine);
    const labels = await instance.parse();

    /* send a message to web client when we are halfway through */
    stateData.progress = 50;
    await bindIotPublish(stateData.compact());

    instance = new KeyPhrases(metaMachine);
    const phrases = await instance.parse();

    instance = new Locations(metaMachine);
    const locations = await instance.parse();

    instance = new Persons(metaMachine);
    const persons = await instance.parse();

    /* send a message to web client when we are 75% done */
    stateData.progress = 75;
    await bindIotPublish(stateData.compact());

    const result = {
      UUID: asset.uuid,
      StartAt: 0,
      Duration: Number.parseInt(mediainfo.container.duration / 1000, 10),
      Celebrities: celebrities || {},
      Emotions: emotions || {},
      Labels: labels || {},
      KeyPhrases: phrases || {},
      Locations: locations || {},
      Persons: persons || {},
    };

    /* upload the result to proxy bucket */
    const {
      dir,
    } = PATH.parse(asset.proxy.key);

    const params = {
      Bucket: asset.proxy.bucket,
      Key: PATH.join(dir, 'analytics', 'results.json'),
      Body: JSON.stringify(result, null, 2),
      ContentType: 'application/json',
      ContentDisposition: 'attachment',
    };

    await VideoAsset.upload(params);

    /* send message to IoT when we are 100% */
    stateData.status = 'COMPLETED';

    const promises = [];

    /* send to IoT */
    const compactData = stateData.compact();

    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(compactData, null, 2)}`);
    promises.push(bindIotPublish(compactData));

    /* send SNS notification */
    const fullData = stateData.toJSON();
    const payload = Object.assign({}, fullData);

    delete payload.Config;
    delete payload.DataInTransit;

    promises.push(PublishSNS(`Metadata completed: ${asset.glacier.name}`, payload));

    await Promise.all(promises);
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
    throw e;
  }
};
