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
  StateData,
  AnalysisError,
} = require('m2c-core-lib');

const {
  DocumentAnalysis,
} = require('./lib');

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
 * @exports onDocumentAnalysis
 */
exports.onDocumentAnalysis = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.DocumentAnalysis, event, context);
    const {
      textract,
    } = new DocumentAnalysis(stateData);

    /* state routing */
    switch (stateData.operation) {
      case StateData.States.StartDocumentText:
        await textract.text.startJob();
        break;
      case StateData.States.CheckDocumentTextStatus:
        await textract.text.checkJobStatus();
        break;
      case StateData.States.CollectDocumentTextResults:
        await textract.text.collectJobResults();
        break;
      case StateData.States.StartDocumentAnalysis:
        await textract.analysis.startJob();
        break;
      case StateData.States.CheckDocumentAnalysisStatus:
        await textract.analysis.checkJobStatus();
        break;
      case StateData.States.CollectDocumentAnalysisResults:
        await textract.analysis.collectJobResults();
        break;
      default:
        break;
    }

    return stateData.toNextState();
  } catch (e) {
    process.env.ENV_QUIET || console.error(e);
    throw e;
  }
};
