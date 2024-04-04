// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  M2CException,
} = require('core-lib');
const ApiRequest = require('./lib/apiRequest');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_IOT_THING_POLICY_NAME',
  'ENV_PROXY_BUCKET',
];

exports.handler = async (event, context) => {
  try {
    console.log(`
      event = ${JSON.stringify(event, null, 2)}
      context = ${JSON.stringify(context, null, 2)}`);

    const missing = REQUIRED_ENVS.filter(x =>
      process.env[x] === undefined);
    if (missing.length) {
      throw new M2CException(`missing enviroment variables, ${missing.join(', ')}`);
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
        throw new M2CException(`${request.method} not supported`);
    }
  } catch (e) {
    console.error(`fatal: exports.onRequest = ${e.message} ${e.stack}`);
    throw e;
  }
};
