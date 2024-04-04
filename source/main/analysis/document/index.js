// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  AnalysisError,
} = require('core-lib');
const StateStartDocumentAnalysis = require('./states/start-document-analysis');
const StateCollectAnalysisResults = require('./states/collect-analysis-results');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_PROXY_BUCKET',
  'ENV_ES_DOMAIN_ENDPOINT',
];

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.DocumentAnalysis, event, context);

    /* state routing */
    let instance;
    switch (stateData.operation) {
      case StateData.States.StartDocumentAnalysis:
        instance = new StateStartDocumentAnalysis(stateData);
        break;
      case StateData.States.CollectDocumentAnalysisResults:
        instance = new StateCollectAnalysisResults(stateData);
        break;
      default:
        break;
    }

    if (!instance) {
      throw new AnalysisError(`${event.operation} not supported`);
    }
    await instance.process();
    return stateData.toJSON();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
