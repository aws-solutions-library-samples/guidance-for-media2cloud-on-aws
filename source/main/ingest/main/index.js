// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment,
  StateData,
  IotStatus,
  IngestError,
} = require('core-lib');
const StateCreateRecord = require('./states/create-record');
const StateFixityCompleted = require('./states/fixity-completed');
const StateIndexIngestResults = require('./states/index-ingest-results');
const StateJobCompleted = require('./states/job-completed');
const StateUpdateRecord = require('./states/update-record');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_INGEST_BUCKET',
  'ENV_PROXY_BUCKET',
  'ENV_SNS_TOPIC_ARN',
  'ENV_ES_DOMAIN_ENDPOINT',
];

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new IngestError(`missing enviroment variables, ${missing.join(', ')}`);
    }
    let modified;
    if (event.nestedStateOutput === undefined) {
      modified = event;
    }
    else if (event.nestedStateOutput.ExecutionArn) {
      modified = {
        ...JSON.parse(event.nestedStateOutput.Output),
        operation: event.operation,
      };
    }
    else {
      modified = {
        ...event.nestedStateOutput,
        operation: event.operation,
      };
    }

    const stateData = new StateData(Environment.StateMachines.Ingest, modified, context);

    let instance;
    /* state switching */
    switch (modified.operation) {
      case StateData.States.CreateRecord:
        instance = new StateCreateRecord(stateData);
        break;
      case StateData.States.FixityCompleted:
        instance = new StateFixityCompleted(stateData);
        break;
      case StateData.States.UpdateRecord:
        instance = new StateUpdateRecord(stateData);
        break;
      case StateData.States.IndexIngestResults:
        instance = new StateIndexIngestResults(stateData);
        break;
      case StateData.States.JobCompleted:
        instance = new StateJobCompleted(stateData);
        break;
      default:
        break;
    }

    if (!instance) {
      throw new IngestError(`${event.operation} not supported`);
    }
    await instance.process();
    await IotStatus.publish(stateData.miniJSON());
    return stateData.toJSON();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
