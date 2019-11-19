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
/* eslint-disable no-unused-vars */

const {
  Environment,
  IotStatus,
  StateData,
  AnalysisError,
} = require('m2c-core-lib');

const {
  Analysis,
} = require('./lib');

const {
  Indexer,
} = require('./lib/indexer');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_INGEST_BUCKET',
  'ENV_PROXY_BUCKET',
  'ENV_SNS_TOPIC_ARN',
  'ENV_DEFAULT_AI_OPTIONS',
  'ENV_DEFAULT_LANGUAGE_CODE',
  'ENV_DEFAULT_COLLECTION_ID',
  'ENV_DEFAULT_VOCABULARY',
  'ENV_DEFAULT_MINCONFIDENCE',
  'ENV_COMPREHEND_ROLE',
];

/**
 * @exports onAnalysisMonitor
 */
exports.onAnalysisMonitor = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.Analysis, event, context);
    const instance = new Analysis(stateData);
    const indexer = new Indexer(stateData);

    /* state switching */
    switch (event.operation) {
      case StateData.States.StartAnalysis:
        await instance.startAnalysis();
        break;
      case StateData.States.CheckAnalysisStatus:
        await instance.checkAnalysisStatus();
        break;
      case StateData.States.CollectAnalysisResults:
        await instance.collectAnalysisResults();
        break;
      case StateData.States.IndexAnalysisResults:
        await indexer.indexResults();
        break;
      case StateData.States.JobCompleted:
        await instance.onCompleted();
        break;
      default:
        break;
    }

    await IotStatus.publish(stateData.responseData);

    return stateData.toNextState();
  } catch (e) {
    process.env.ENV_QUIET || console.error(e);
    throw e;
  }
};
