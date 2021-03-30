/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  Environment,
  StateData,
  AnalysisError,
} = require('core-lib');
/* transcribe */
const StateStartTranscribe = require('./states/start-transcribe');
const StateCollectTranscribeResults = require('./states/collect-transcribe-results');
/* comprehend entity */
const StateStartEntity = require('./states/start-entity');
const StateCreateEntityTrack = require('./states/create-entity-track');
/* comprehend keyphrase */
const StateStartKeyphrase = require('./states/start-keyphrase');
const StateCreateKeyphraseTrack = require('./states/create-keyphrase-track');
/* comprehend sentiment */
const StateStartSentiment = require('./states/start-sentiment');
const StateCreateSentimentTrack = require('./states/create-sentiment-track');
/* comprehend custom entity */
const StateCheckCustomEntityCriteria = require('./states/check-custom-entity-criteria');
const StateStartCustomEntity = require('./states/start-custom-entity');
const StateCheckCustomEntityStatus = require('./states/check-custom-entity-status');
const StateCreateCustomEntityTrack = require('./states/create-custom-entity-track');
/* job completed */
const StateJobCompleted = require('./states/job-completed');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_PROXY_BUCKET',
  'ENV_DATA_ACCESS_ROLE',
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
      if (Array.isArray(merged.parallelStateOutputs)) {
        merged.uuid = merged.parallelStateOutputs[0].uuid;
        merged.overallStatus = merged.parallelStateOutputs[0].overallStatus;
        merged.input = {
          ...merged.input,
        };
        merged.data = {
          ...merged.data,
        };
        const parallelStateOutputs = merged.parallelStateOutputs.slice(0);
        delete merged.parallelStateOutputs;
        while (parallelStateOutputs.length) {
          const data = parallelStateOutputs.shift();
          merged.input = {
            ...merged.input,
            ...data.input,
          };
          merged.data.transcribe = {
            ...merged.data.transcribe,
            ...data.data.transcribe,
          };
          merged.data.comprehend = {
            ...merged.data.comprehend,
            ...data.data.comprehend,
          };
        }
      } else {
        const singleStateOutput = merged.parallelStateOutputs;
        delete merged.parallelStateOutputs;
        merged.uuid = singleStateOutput.uuid;
        merged.overallStatus = singleStateOutput.overallStatus;
        merged.input = singleStateOutput.input;
        merged.data = singleStateOutput.data;
      }
    }

    const stateData = new StateData(Environment.StateMachines.AudioAnalysis, merged, context);

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
      /* comprehend */
      case StateData.States.StartEntity:
        instance = new StateStartEntity(stateData);
        break;
      case StateData.States.CreateEntityTrack:
        instance = new StateCreateEntityTrack(stateData);
        break;
      case StateData.States.StartKeyphrase:
        instance = new StateStartKeyphrase(stateData);
        break;
      case StateData.States.CreateKeyphraseTrack:
        instance = new StateCreateKeyphraseTrack(stateData);
        break;
      case StateData.States.StartSentiment:
        instance = new StateStartSentiment(stateData);
        break;
      case StateData.States.CreateSentimentTrack:
        instance = new StateCreateSentimentTrack(stateData);
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
