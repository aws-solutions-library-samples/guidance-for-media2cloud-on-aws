/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable global-require */
const {
  ApiRequest,
} = require('./lib/apiRequest');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_IOT_THING_POLICY_NAME',
  'ENV_WORKTEAM_NAME',
  'ENV_GSI_INDEX_NAME',
];

/**
 * @function onRequest
 * @description start or get state machine
 */
exports.onRequest = async (event, context) => {
  try {
    console.log(`
      event = ${JSON.stringify(event, null, 2)}
      context = ${JSON.stringify(context, null, 2)}`);

    const missing = REQUIRED_ENVS.filter(x =>
      process.env[x] === undefined);
    if (missing.length) {
      throw new Error(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const request = new ApiRequest(event, context);
    const processor = request.getProcessor();

    console.log(`processing ${processor.constructor.name}.${request.method} request`);
    switch (request.method) {
      case 'OPTIONS':
        return processor.onOPTIONS().catch(e =>
          processor.onError(e));
      case 'GET':
        return processor.onGET().catch(e =>
          processor.onError(e));
      case 'POST':
        return processor.onPOST().catch(e =>
          processor.onError(e));
      case 'DELETE':
        return processor.onDELETE().catch(e =>
          processor.onError(e));
      default:
        throw new Error(`${request.method} not supported`);
    }
  } catch (e) {
    console.error(`fatal: exports.onRequest = ${e.message} ${e.stack}`);
    throw e;
  }
};
