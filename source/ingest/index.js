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
  IotStatus,
  IngestError,
} = require('m2c-core-lib');

const {
  Ingest,
} = require('./lib');

const {
  Indexer,
} = require('./lib/indexer');

const {
  S3Restore,
} = require('./lib/s3restore');

const {
  Checksum,
} = require('./lib/checksum');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_MEDIACONVERT_HOST',
  'ENV_MEDIACONVERT_ROLE',
  'ENV_INGEST_BUCKET',
  'ENV_PROXY_BUCKET',
  'ENV_SNS_TOPIC_ARN',
];

/**
 * @exports onIngest
 */
exports.onIngest = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new IngestError(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const stateData = new StateData(Environment.StateMachines.Ingest, event, context);
    const instance = new Ingest(stateData);
    const indexer = new Indexer(stateData);
    const restore = new S3Restore(stateData);
    const checksum = new Checksum(stateData);

    /* state switching */
    switch (event.operation) {
      case StateData.States.CreateRecord:
        await instance.createRecord();
        break;
      case StateData.States.CheckRestoreStatus:
        await restore.checkRestoreStatus();
        break;
      case StateData.States.ComputeChecksum:
        await checksum.computeChecksum();
        break;
      case StateData.States.ValidateChecksum:
        await checksum.validateChecksum();
        break;
      case StateData.States.RunImageInfo:
        await instance.runImageInfo();
        break;
      case StateData.States.RunMediainfo:
        await instance.runMediainfo();
        break;
      case StateData.States.StartTranscode:
        await instance.startTranscode();
        break;
      case StateData.States.CheckTranscodeStatus:
        await instance.checkTranscodeStatus();
        break;
      case StateData.States.UpdateRecord:
        await instance.updateRecord();
        break;
      case StateData.States.IndexIngestResults:
        await indexer.indexResults();
        break;
      case StateData.States.JobCompleted:
        await instance.onCompleted();
        break;
      default:
        break;
    }

    await IotStatus.publish(stateData.responseData);

    return stateData.toNextState();
  } catch (e) {
    process.env.ENV_QUIET || console.error(e);
    throw e;
  }
};
