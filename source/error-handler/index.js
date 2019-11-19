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
/* eslint-disable no-await-in-loop */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-continue */
const AWS = require('aws-sdk');

const {
  Environment,
  StateData,
  IotStatus,
  SNS,
} = require('m2c-core-lib');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_STACKNAME',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_HOST',
  'ENV_SNS_TOPIC_ARN',
  'ENV_INGEST_BUCKET',
  'ENV_PROXY_BUCKET',
];

/**
 * @exports onErrorHandler
 */
exports.onErrorHandler = async (event, context) => {
  async function getExecutionError(arn) {
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    let response;
    let executions;
    do {
      response = await step.getExecutionHistory({
        executionArn: arn,
        maxResults: 20,
        reverseOrder: true,
        nextToken: (response || {}).nextToken,
      }).promise().catch(e => undefined);

      executions = response.events.filter(x => ([
        'Failed',
        'Aborted',
        'TimeOut',
      ].findIndex(x0 => x.type.indexOf(x0) >= 0) >= 0));
    } while ((response || {}).nextToken && !executions);
    return executions;
  }

  function parseExecutionError(arn, executions = []) {
    let message;
    while (executions.length) {
      const task = executions.shift();
      if ((task.lambdaFunctionFailedEventDetails || {}).cause) {
        return task.lambdaFunctionFailedEventDetails.cause;
      }

      if ((task.lambdaFunctionTimedOutEventDetails || {}).cause) {
        return task.lambdaFunctionTimedOutEventDetails.cause;
      }

      if ((task.executionFailedEventDetails || {}).cause) {
        return task.executionFailedEventDetails.cause;
      }

      if ((task.taskTimedOutEventDetails || {}).cause) {
        return task.taskTimedOutEventDetails.cause;
      }

      if ((task.executionAbortedEventDetails || {}).cause) {
        return task.executionAbortedEventDetails.cause;
      }
      message = `${arn} ${task.type}`;
    }
    return message;
  }

  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
    if (!event.detail) {
      throw new Error('event.detail is missing. Cannot handle this error. exiting...');
    }

    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new Error(`missing enviroment variables, ${missing.join(', ')}`);
    }

    const executions = await getExecutionError(event.detail.executionArn);

    let message = parseExecutionError(event.detail.executionArn, executions)
      || `${event.detail.executionArn} ${event.detail.status}`;

    /* check to see if it is JSON string */
    try {
      message = JSON.parse(message).errorMessage || message;
    } catch (e) {
      // do nothing
    }

    const input = JSON.parse(event.detail.input);
    const stateMachine = event.detail.executionArn.split(':')[6];

    const response = {
      uuid: input.uuid || input.contentUuid,
      stateMachine,
      status: StateData.Statuses.Error,
      errorMessage: message,
    };

    return Promise.all([
      SNS.send(`${input.uuid || input.contentUuid || 'Unknown'} error`, Object.assign(response, {
        input,
      })).catch(() => undefined),
      IotStatus.publish(response).catch(() => undefined),
    ]);
  } catch (e) {
    console.error(e);
    return undefined;
  }
};
