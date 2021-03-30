/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  Environment,
  StateData,
  ChecksumError,
} = require('core-lib');

const StateCheckRestoreStatus = require('./states/check-restore-status');
const StateComputeChecksum = require('./states/compute-checksum');
const StateValidateChecksum = require('./states/validate-checksum');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_INGEST_BUCKET',
];

/**
 * @exports handler
 */
exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new ChecksumError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.Ingest, event, context);
    let instance;
    switch (event.operation) {
      case StateData.States.CheckRestoreStatus:
        instance = new StateCheckRestoreStatus(stateData);
        break;
      case StateData.States.ComputeChecksum:
        instance = new StateComputeChecksum(stateData);
        break;
      case StateData.States.ValidateChecksum:
        instance = new StateValidateChecksum(stateData);
        break;
      default:
        break;
    }
    if (!instance) {
      throw new ChecksumError(`${event.operation} not supported`);
    }
    await instance.process();
    return stateData.toJSON();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
