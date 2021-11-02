// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  Environment,
  StateData,
  AnalysisError,
} = require('core-lib');
const StateStartImageAnalysis = require('./states/start-image-analysis');
const StateIndexAnalysisResults = require('./states/index-analysis-results');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_PROXY_BUCKET',
];

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.ImageAnalysis, event, context);

    /* state routing */
    let instance;
    switch (stateData.operation) {
      case StateData.States.StartImageAnalysis:
        instance = new StateStartImageAnalysis(stateData);
        break;
      case StateData.States.IndexAnalysisResults:
        instance = new StateIndexAnalysisResults(stateData);
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
