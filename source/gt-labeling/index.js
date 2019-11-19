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
} = require('m2c-core-lib');

const {
  GroundTruth,
} = require('./lib');

/**
 * @exports onLabelingJobEvent
 * @description handle pre/post-labeling events
 */
exports.onLabelingJobEvent = async (event, context) => {
  if (event.dataObject) {
    return GroundTruth.preLabeling(event);
  }
  return GroundTruth.postLabeling(event);
};

/**
 * @exports onLabeling
 * @description handle ground truth labeling state machine
 */
exports.onLabeling = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);

  try {
    const stateData = new StateData(Environment.StateMachines.GroundTruth, event, context);
    const instance = new GroundTruth(stateData);

    switch (event.operation) {
      case StateData.States.CreateDataset:
        await instance.createDataset();
        break;
      case StateData.States.CreateLabelingJob:
        await instance.createJob();
        break;
      case StateData.States.CheckLabelingStatus:
        await instance.checkLabelingStatus();
        break;
      case StateData.States.IndexResults:
        await instance.indexResults();
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
