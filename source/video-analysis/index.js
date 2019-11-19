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
  VideoAnalysis,
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
 * @exports onVideoAnalysis
 */
exports.onVideoAnalysis = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new AnalysisError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.VideoAnalysis, event, context);
    const {
      rekognition,
    } = new VideoAnalysis(stateData);

    /* state routing */
    switch (stateData.operation) {
      /* celeb */
      case StateData.States.StartCelebrity:
        await rekognition.celeb.startJob();
        break;
      case StateData.States.CheckCelebrityStatus:
        await rekognition.celeb.checkJobStatus();
        break;
      case StateData.States.CollectCelebrityResults:
        await rekognition.celeb.collectJobResults();
        break;
      case StateData.States.CreateCelebrityTrack:
        await rekognition.celeb.createTrack();
        break;
      /* face */
      case StateData.States.StartFace:
        await rekognition.face.startJob();
        break;
      case StateData.States.CheckFaceStatus:
        await rekognition.face.checkJobStatus();
        break;
      case StateData.States.CollectFaceResults:
        await rekognition.face.collectJobResults();
        break;
      case StateData.States.CreateFaceTrack:
        await rekognition.face.createTrack();
        break;
      /* faceMatch */
      case StateData.States.StartFaceMatch:
        await rekognition.faceMatch.startJob();
        break;
      case StateData.States.CheckFaceMatchStatus:
        await rekognition.faceMatch.checkJobStatus();
        break;
      case StateData.States.CollectFaceMatchResults:
        await rekognition.faceMatch.collectJobResults();
        break;
      case StateData.States.CreateFaceMatchTrack:
        await rekognition.faceMatch.createTrack();
        break;
      /* label */
      case StateData.States.StartLabel:
        await rekognition.label.startJob();
        break;
      case StateData.States.CheckLabelStatus:
        await rekognition.label.checkJobStatus();
        break;
      case StateData.States.CollectLabelResults:
        await rekognition.label.collectJobResults();
        break;
      case StateData.States.CreateLabelTrack:
        await rekognition.label.createTrack();
        break;
      /* moderation */
      case StateData.States.StartModeration:
        await rekognition.moderation.startJob();
        break;
      case StateData.States.CheckModerationStatus:
        await rekognition.moderation.checkJobStatus();
        break;
      case StateData.States.CollectModerationResults:
        await rekognition.moderation.collectJobResults();
        break;
      case StateData.States.CreateModerationTrack:
        await rekognition.moderation.createTrack();
        break;
      /* person */
      case StateData.States.StartPerson:
        await rekognition.person.startJob();
        break;
      case StateData.States.CheckPersonStatus:
        await rekognition.person.checkJobStatus();
        break;
      case StateData.States.CollectPersonResults:
        await rekognition.person.collectJobResults();
        break;
      case StateData.States.CreatePersonTrack:
        await rekognition.person.createTrack();
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
