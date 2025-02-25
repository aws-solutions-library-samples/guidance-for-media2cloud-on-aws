// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  AnalysisError,
  AnalysisTypes: {
    Rekognition: {
      CustomLabel,
    },
  },
} = require('core-lib');

/* frame-based analysis */
const StatePrepareFrameDetectionIterators = require('./states/prepare-frame-detection-iterators');
const StateDetectFrameIterator = require('./states/detect-frame-iterator');
const StatePrepareFrameTrackIterators = require('./states/prepare-frame-track-iterators');
/* video-based analysis */
const StatePrepareVideoDetectionIterators = require('./states/prepare-video-detection-iterators');
/* custom analysis */
const StatePrepareCustomDetectionIterators = require('./states/prepare-custom-detection-iterators');
/* shared */
const StateStartDetectionIterator = require('./states/start-detection-iterator');
const StateCollectResultsIterator = require('./states/collect-results-iterator');
const StateCreateTrackIterator = require('./states/create-track-iterator');
const StateIndexAnalysisIterator = require('./states/index-analysis-iterator');
/* Prerun states */
const StatePrepareSegmentDetection = require('./states/prepare-segment-detection');
const StateSelectSegmentFrames = require('./states/select-segment-frames');
const StateFrameSegmentationCompleted = require('./states/frame-segmentation-completed');
/* job completed */
const StateJobCompleted = require('./states/job-completed');
// advanced feature
const StateCreateSceneEvents = require('./states/create-scene-events');
// pre-analysis branch
const StateConfigurePreAnalysisIterators = require('./states/configure-preanalysis-iterators');
const StatePreAnalysisIteratorsCompleted = require('./states/preanalysis-iterators-completed');
// faceapi model
const StatePrepareFaceApiModelIterators = require('./states/prepare-faceapi-model-iterators');
const StateRunFaceApiModelCompleted = require('./states/run-faceapi-model-completed');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_PROXY_BUCKET',
  // Backlog service
  'ENV_BACKLOG_EB_BUS',
  'ENV_BACKLOG_TABLE',
  'ENV_BACKLOG_TOPIC_ARN',
  'ENV_BACKLOG_TOPIC_ROLE_ARN',
  'ENV_ES_DOMAIN_ENDPOINT',
];
const CATEGORY = 'rekognition';

function parseEvent(event, context) {
  const stateMachine = Environment.StateMachines.VideoAnalysis;

  let parsed = event;
  if (!parsed.parallelStateOutputs) {
    return new StateData(stateMachine, parsed, context);
  }

  if (!parsed.stateExecution) {
    throw new AnalysisError('fail to parse event.stateExecution');
  }

  // parse execution input object
  const uuid = parsed.stateExecution.Input.uuid;
  const input = parsed.stateExecution.Input.input;
  const startTime = parsed.stateExecution.StartTime;
  const executionArn = parsed.stateExecution.Id;
  delete parsed.stateExecution;
  if (!uuid || !input) {
    throw new AnalysisError('fail to find uuid or input from event.stateExecution');
  }

  // parse parallel state outputs
  const parallelStateOutputs = parsed.parallelStateOutputs;
  delete parsed.parallelStateOutputs;

  const categories = {};
  const iterators = [];

  parallelStateOutputs.forEach((output) => {
    // video based analysis
    if (!Array.isArray(output)) {
      output.data.iterators.forEach((iterator) => {
        iterators.push(iterator.data);
      });
      return;
    }

    // frame based & custom model analysis (nested outputs)
    output.forEach((out) => {
      out.data.iterators.forEach((iterator) => {
        iterators.push(iterator.data);
      });
    });
  });

  iterators.forEach((iterator) => {
    const names = Object.keys(iterator);

    names.forEach((name) => {
      // could have multiple custom label results
      if (name === CustomLabel) {
        categories[name] = (categories[name] || [])
          .concat(iterator[name]);
      } else {
        categories[name] = {
          ...categories[name],
          ...iterator[name],
        };
      }
    });
  });

  parsed = {
    ...parsed,
    uuid,
    input,
    startTime,
    executionArn,
    status: StateData.Statuses.NotStarted,
    progress: 0,
    data: {
      [CATEGORY]: {
        ...categories,
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
    const { operation } = stateData;

    let instance;
    switch (operation) {
      /* frame-based analysis */
      case StateData.States.PrepareFrameDetectionIterators:
        instance = new StatePrepareFrameDetectionIterators(stateData);
        break;
      case StateData.States.DetectFrameIterator:
        instance = new StateDetectFrameIterator(stateData);
        break;
      case StateData.States.PrepareFrameTrackIterators:
        instance = new StatePrepareFrameTrackIterators(stateData);
        break;
      /* video-based analysis */
      case StateData.States.PrepareVideoDetectionIterators:
        instance = new StatePrepareVideoDetectionIterators(stateData);
        break;
      /* custom analysis */
      case StateData.States.PrepareCustomDetectionIterators:
        instance = new StatePrepareCustomDetectionIterators(stateData);
        break;
      /* shared */
      case StateData.States.StartDetectionIterator:
        instance = new StateStartDetectionIterator(stateData);
        break;
      case StateData.States.CollectResultsIterator:
        instance = new StateCollectResultsIterator(stateData);
        break;
      case StateData.States.CreateTrackIterator:
        instance = new StateCreateTrackIterator(stateData);
        break;
      case StateData.States.IndexAnalysisResults:
        instance = new StateIndexAnalysisIterator(stateData);
        break;
      case StateData.States.PrepareSegmentDetection:
        instance = new StatePrepareSegmentDetection(stateData);
        break;
      case StateData.States.SelectSegmentFrames:
        instance = new StateSelectSegmentFrames(stateData);
        break;
      case StateData.States.CreateSceneEvents:
        instance = new StateCreateSceneEvents(stateData);
        break;
      case StateData.States.JobCompleted:
        instance = new StateJobCompleted(stateData);
        break;
      default:
        break;
    }

    if (!instance) {
      if (StateConfigurePreAnalysisIterators.opSupported(operation)) {
        instance = new StateConfigurePreAnalysisIterators(stateData);
      } else if (StatePreAnalysisIteratorsCompleted.opSupported(operation)) {
        instance = new StatePreAnalysisIteratorsCompleted(stateData);
      } else if (StatePrepareFaceApiModelIterators.opSupported(operation)) {
        instance = new StatePrepareFaceApiModelIterators(stateData);
      } else if (StateRunFaceApiModelCompleted.opSupported(operation)) {
        instance = new StateRunFaceApiModelCompleted(stateData);
      } else if (StateFrameSegmentationCompleted.opSupported(operation)) {
        instance = new StateFrameSegmentationCompleted(stateData);
      }
    }

    if (!instance) {
      throw new AnalysisError(`${event.operation} not supported`);
    }

    const response = await instance.process();
    if (response instanceof StateData) {
      return stateData.toJSON();
    }
    return response;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
