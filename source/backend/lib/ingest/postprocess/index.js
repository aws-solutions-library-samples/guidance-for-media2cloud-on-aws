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
  DBConfig,
  VideoAsset,
  IotStatus,
  StateIOData,
} = require('../../common');

const {
  send: PublishSNS,
} = require('../../sns/index');

/**
 * @class IngestError
 */
class IngestError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, IngestError);
  }
}

/**
 * @function onIngestCompleted
 * @description collect parallel states' output data, update DB, and fire event to IoT
 * @param {object} event - state machine input data
 * @param {object} [context]
 */
exports.onIngestCompleted = async (event, context) => {
  let bindIotPublish = null;
  const stateData = new StateIOData({
    State: 'ingest',
  });

  try {
    process.env.ENV_QUIET || console.log(JSON.stringify(event, null, 2));

    const {
      Data,
      Config,
      DataInTransit: {
        Proxy,
      },
    } = event;
    if (!Data || !Config || !Proxy) {
      throw new IngestError('malformed input data, Data, Config, Proxy not found');
    }

    const config = new DBConfig(Config);
    stateData.stateMachine = config.ingestStateMachine;
    /* bind to Iot publish function as soon as IotHost / IotStatusTopic are defined */
    bindIotPublish = IotStatus.publish.bind(this, config.iotHost, config.iotStatusTopic);
    stateData.config = config;

    /* here we merge DataInTransit.Proxy into our VideoAsset properties */
    Proxy.Bucket = config.proxyBucket;
    Data.Proxy = Proxy;
    const asset = new VideoAsset(Data);

    /* update database now */
    await asset.updateDB(config.assetTable, config.assetPartitionKey);
    stateData.data = asset;
    stateData.status = 'COMPLETED';

    const promises = [];
    /* tag the object so it transitions to Glacier storage */
    promises.push(asset.setObjectLifecycle());

    /* send to IoT */
    const compactData = stateData.compact();
    process.env.ENV_QUIET || console.log(`mqttPayload = ${JSON.stringify(compactData, null, 2)}`);
    promises.push(bindIotPublish(compactData));

    /* send SNS notification */
    const fullData = stateData.toJSON();
    const payload = Object.assign({}, fullData);
    delete payload.Config;
    delete payload.DataInTransit;
    promises.push(PublishSNS(`Ingest completed: ${asset.glacier.name}`, payload));

    await Promise.all(promises);
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
    throw (e instanceof IngestError) ? e : new IngestError(e);
  }
};
