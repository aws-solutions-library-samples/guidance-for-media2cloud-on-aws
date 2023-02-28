// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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

function parseEvent(event, context) {
  const stateMachine = Environment.StateMachines.ImageAnalysis;
  let parsed = event;
  if (!parsed.parallelStateOutputs) {
    return new StateData(stateMachine, parsed, context);
  }
  if (!parsed.stateExecution) {
    throw new Error('fail to parse event.stateExecution');
  }
  /* parse execution input object */
  const uuid = parsed.stateExecution.Input.uuid;
  const input = parsed.stateExecution.Input.input;
  const startTime = parsed.stateExecution.StartTime;
  const executionArn = parsed.stateExecution.Id;
  delete parsed.stateExecution;
  if (!uuid || !input) {
    throw new Error('fail to find uuid or input from event.stateExecution');
  }
  /* parse parallel state outputs */
  const parallelStateOutputs = parsed.parallelStateOutputs;
  delete parsed.parallelStateOutputs;

  /* merging data.image output */
  let merged = {};
  while (parallelStateOutputs.length) {
    const stateOutput = parallelStateOutputs.shift();
    merged = {
      ...merged,
      ...stateOutput.data.image,
    };
  }

  parsed = {
    ...parsed,
    uuid,
    input,
    progress: 0,
    data: {
      image: {
        ...merged,
        startTime,
        executionArn,
        status: StateData.Statuses.NotStarted,
      },
    },
  };
  return new StateData(stateMachine, parsed, context);
}

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    /* merge parallel state outputs */
    const stateData = parseEvent(event, context);

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
