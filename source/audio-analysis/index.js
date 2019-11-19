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
  AudioAnalysis,
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
 * @exports onAudioAnalysis
 */
exports.onAudioAnalysis = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.AudioAnalysis, event, context);
    const {
      transcribe,
      comprehend,
    } = new AudioAnalysis(stateData);

    /* state routing */
    switch (stateData.operation) {
      /* transcribe */
      case StateData.States.UpdateVocabulary:
        await transcribe.updateVocabulary();
        break;
      case StateData.States.CheckVocabularyStatus:
        await transcribe.checkVocabularyStatus();
        break;
      case StateData.States.StartTranscribe:
        await transcribe.startJob();
        break;
      case StateData.States.CheckTranscribeStatus:
        await transcribe.checkJobStatus();
        break;
      case StateData.States.DownloadTranscripts:
        await transcribe.collectJobResults();
        break;
      case StateData.States.CreateSubtitle:
        await transcribe.createTrack();
        break;
      /* entity */
      case StateData.States.StartEntity:
        await comprehend.entity.startJob();
        break;
      case StateData.States.CheckEntityStatus:
        await comprehend.entity.checkJobStatus();
        break;
      case StateData.States.CollectEntityResults:
        await comprehend.entity.collectJobResults();
        break;
      case StateData.States.CreateEntityTrack:
        await comprehend.entity.createTrack();
        break;
      /* keyphrase */
      case StateData.States.StartKeyphrase:
        await comprehend.keyphrase.startJob();
        break;
      case StateData.States.CheckKeyphraseStatus:
        await comprehend.keyphrase.checkJobStatus();
        break;
      case StateData.States.CollectKeyphraseResults:
        await comprehend.keyphrase.collectJobResults();
        break;
      case StateData.States.CreateKeyphraseTrack:
        await comprehend.keyphrase.createTrack();
        break;
      /* sentiment */
      case StateData.States.StartSentiment:
        await comprehend.sentiment.startJob();
        break;
      case StateData.States.CheckSentimentStatus:
        await comprehend.sentiment.checkJobStatus();
        break;
      case StateData.States.CollectSentimentResults:
        await comprehend.sentiment.collectJobResults();
        break;
      case StateData.States.CreateSentimentTrack:
        await comprehend.sentiment.createTrack();
        break;
      /* topic */
      case StateData.States.StartTopic:
        await comprehend.topic.startJob();
        break;
      case StateData.States.CheckTopicStatus:
        await comprehend.topic.checkJobStatus();
        break;
      case StateData.States.CollectTopicResults:
        await comprehend.topic.collectJobResults();
        break;
      case StateData.States.CreateTopicTrack:
        await comprehend.topic.createTrack();
        break;
      /* classification */
      case StateData.States.StartClassification:
        await comprehend.classification.startJob();
        break;
      case StateData.States.CheckClassificationStatus:
        await comprehend.classification.checkJobStatus();
        break;
      case StateData.States.CollectClassificationResults:
        await comprehend.classification.collectJobResults();
        break;
      case StateData.States.CreateClassificationTrack:
        await comprehend.classification.createTrack();
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
