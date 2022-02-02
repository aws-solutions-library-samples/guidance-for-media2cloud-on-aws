// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  IngestError,
} = require('core-lib');
const StateRunMediaInfo = require('./states/run-mediainfo');
const StateStartTranscode = require('./states/start-transcode');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_INGEST_BUCKET',
  'ENV_PROXY_BUCKET',
];

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new IngestError(`missing enviroment variables, ${missing.join(', ')}`);
    }
    const stateData = new StateData(Environment.StateMachines.Ingest, event, context);
    let instance;
    switch (event.operation) {
      case StateData.States.RunMediainfo:
        instance = new StateRunMediaInfo(stateData);
        break;
      case StateData.States.StartTranscode:
        instance = new StateStartTranscode(stateData);
        break;
      default:
        break;
    }
    if (!instance) {
      throw new IngestError(`${event.operation} not supported`);
    }
    await instance.process();
    return stateData.toJSON();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
