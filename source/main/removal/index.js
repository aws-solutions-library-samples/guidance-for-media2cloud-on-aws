// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  M2CException,
} = require('core-lib');
const StateAssetRemoval = require('./states/asset-removal');

const REQUIRED_ENVS = [
  'ENV_EXPECTED_BUCKET_OWNER',
  'ENV_CUSTOM_USER_AGENT',
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_PROXY_BUCKET',
  'ENV_ES_DOMAIN_ENDPOINT',
  'ENV_USE_OPENSEARCH_SERVERLESS',
];

exports.handler = async (event, context) => {
  try {
    console.log(
      'event =',
      JSON.stringify(event, null, 2),
      '\ncontext =',
      JSON.stringify(context, null, 2)
    );

    const missing = REQUIRED_ENVS
      .filter((x) =>
        process.env[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const instance = new StateAssetRemoval(event, context);

    const response = await instance.process();

    return response;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
