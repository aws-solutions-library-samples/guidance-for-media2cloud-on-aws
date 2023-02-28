// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  AnalysisError,
} = require('core-lib');
/* transcribe */
const StateStartTranscribe = require('./states/start-transcribe');
const StateCollectTranscribeResults = require('./states/collect-transcribe-results');
const StateIndexTranscribeResults = require('./states/index-transcribe-results');
/* comprehend entity */
const StateStartEntity = require('./states/start-entity');
const StateIndexEntityResults = require('./states/index-entity-results');
/* comprehend keyphrase */
const StateStartKeyphrase = require('./states/start-keyphrase');
const StateIndexKeyphraseResults = require('./states/index-keyphrase-results');
/* comprehend sentiment */
const StateStartSentiment = require('./states/start-sentiment');
const StateIndexSentimentResults = require('./states/index-sentiment-results');
/* comprehend custom entity */
const StateCheckCustomEntityCriteria = require('./states/check-custom-entity-criteria');
const StateStartCustomEntity = require('./states/start-custom-entity');
const StateCheckCustomEntityStatus = require('./states/check-custom-entity-status');
const StateCreateCustomEntityTrack = require('./states/create-custom-entity-track');
const StateIndexCustomEntityResults = require('./states/index-custom-entity-results');
/* job completed */
const StateJobCompleted = require('./states/job-completed');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_PROXY_BUCKET',
  'ENV_DATA_ACCESS_ROLE',
  'ENV_ES_DOMAIN_ENDPOINT',
];

function parseEvent(event, context) {
  const stateMachine = Environment.StateMachines.AudioAnalysis;
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
  /* parse and merge parallel state outputs */
  const parallelStateOutputs = parsed.parallelStateOutputs;
  delete parsed.parallelStateOutputs;
  /* can be single state output if only transcribe is enabled */
  const merged = {};
  if (!Array.isArray(parallelStateOutputs)) {
    merged.transcribe = parallelStateOutputs.data.transcribe;
  } else {
    while (parallelStateOutputs.length) {
      const stateOutput = parallelStateOutputs.shift();
      merged.transcribe = {
        ...merged.transcribe,
        ...stateOutput.data.transcribe,
      };
      merged.comprehend = {
        ...merged.comprehend,
        ...stateOutput.data.comprehend,
      };
    }
  }
  parsed = {
    ...parsed,
    uuid,
    input,
    startTime,
    executionArn,
    status: StateData.Statuses.NotStarted,
    progress: 0,
    data: {
      ...merged,
    },
  };
  return new StateData(stateMachine, parsed, context);
}

exports.parseEvent = parseEvent;

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }
    const stateData = parseEvent(event, context);
    /* state routing */
    let instance;
    switch (stateData.operation) {
      /* transcribe */
      case StateData.States.StartTranscribe:
        instance = new StateStartTranscribe(stateData);
        break;
      case StateData.States.CollectTranscribeResults:
        instance = new StateCollectTranscribeResults(stateData);
        break;
      case StateData.States.IndexTranscribeResults:
        instance = new StateIndexTranscribeResults(stateData);
        break;
      /* comprehend */
      case StateData.States.StartEntity:
        instance = new StateStartEntity(stateData);
        break;
      case StateData.States.IndexEntityResults:
        instance = new StateIndexEntityResults(stateData);
        break;
      case StateData.States.StartKeyphrase:
        instance = new StateStartKeyphrase(stateData);
        break;
      case StateData.States.IndexKeyphraseResults:
        instance = new StateIndexKeyphraseResults(stateData);
        break;
      case StateData.States.StartSentiment:
        instance = new StateStartSentiment(stateData);
        break;
      case StateData.States.IndexSentimentResults:
        instance = new StateIndexSentimentResults(stateData);
        break;
      case StateData.States.CheckCustomEntityCriteria:
        instance = new StateCheckCustomEntityCriteria(stateData);
        break;
      case StateData.States.StartCustomEntity:
        instance = new StateStartCustomEntity(stateData);
        break;
      case StateData.States.CheckCustomEntityStatus:
        instance = new StateCheckCustomEntityStatus(stateData);
        break;
      case StateData.States.CreateCustomEntityTrack:
        instance = new StateCreateCustomEntityTrack(stateData);
        break;
      case StateData.States.IndexCustomEntityResults:
        instance = new StateIndexCustomEntityResults(stateData);
        break;
      /* job completed */
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

    return stateData.toJSON();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
