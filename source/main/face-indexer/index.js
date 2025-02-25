// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  M2CException,
} = require('core-lib');
const StateImportCollection = require('./states/import-collection');
const StatePrepareIterators = require('./states/prepare-iterators');
const StateUpdateRecord = require('./states/update-record');
const StatePrepareFaceIndexingIterators = require('./states/prepare-face-indexing-iterators');
// StateRunFaceApiModel runs docker image in lambda
const StateIndexFacesToCollection = require('./states/index-faces-to-collection');
const StateFaceIndexingIteratorsCompleted = require('./states/face-indexing-iterators-completed');

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

    let instance;
    if (event.operation === 'StateImportCollection') {
      instance = new StateImportCollection(event, context);
    } else if (event.operation === 'StatePrepareIterators') {
      instance = new StatePrepareIterators(event, context);
    } else if (event.operation === 'StateUpdateRecord') {
      instance = new StateUpdateRecord(event, context);
    } else if (event.operation === 'StatePrepareFaceIndexingIterators') {
      instance = new StatePrepareFaceIndexingIterators(event, context);
    } else if (event.operation === 'StateIndexFacesToCollection') {
      instance = new StateIndexFacesToCollection(event, context);
    } else if (event.operation === 'StateFaceIndexingIteratorsCompleted') {
      instance = new StateFaceIndexingIteratorsCompleted(event, context);
    } else {
      throw new M2CException('invalid operation');
    }

    const response = await instance.process();

    return response;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
