/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  Environment,
  IotStatus,
  StateData,
  AnalysisError,
} = require('core-lib');

const StatePrepareAnalysis = require('./states/prepare-analysis');
const StateCollectAnalysisResults = require('./states/collect-analysis-results');
const StateIndexAnalysisResults = require('./states/index-analysis-results');
const StateJobCompleted = require('./states/job-completed');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_PROXY_BUCKET',
  'ENV_SNS_TOPIC_ARN',
  'ENV_DEFAULT_AI_OPTIONS',
  'ENV_DEFAULT_MINCONFIDENCE',
];

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }
    /* merge Parallel state outputs */
    const merged = event;
    if (merged.parallelStateOutputs) {
      const parallelStateOutputs = merged.parallelStateOutputs.slice(0);
      delete merged.parallelStateOutputs;
      while (parallelStateOutputs.length) {
        const data = parallelStateOutputs.shift();
        if (!data.ExecutionArn) {
          merged.uuid = data.uuid;
          merged.input = {
            ...merged.input,
            ...data.input,
          };
          merged.data = {
            ...merged.data,
            ...data.data,
          };
        } else if (data.Output) {
          const output = JSON.parse(data.Output);
          merged.uuid = output.uuid;
          merged.input = {
            ...merged.input,
            ...output.input,
          };
          merged.data = {
            ...merged.data,
            ...output.data,
          };
        }
      }
    }

    /* state switching */
    const stateData = new StateData(Environment.StateMachines.Analysis, merged, context);
    let instance;
    switch (merged.operation) {
      case StateData.States.PrepareAnalysis:
        instance = new StatePrepareAnalysis(stateData);
        break;
      case StateData.States.CollectAnalysisResults:
        instance = new StateCollectAnalysisResults(stateData);
        break;
      case StateData.States.IndexAnalysisResults:
        instance = new StateIndexAnalysisResults(stateData);
        break;
      case StateData.States.JobCompleted:
        instance = new StateJobCompleted(stateData);
        break;
      default:
        break;
    }
    if (!instance) {
      throw new AnalysisError(`${event.operation} not supported`);
    }
    await instance.process();
    await IotStatus.publish(stateData.miniJSON());
    return stateData.toJSON();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
