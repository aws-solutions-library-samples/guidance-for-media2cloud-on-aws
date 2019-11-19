/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * execution-summary.js - summarize resources used for a specific state machine execution
 * * numbers of state transitions
 * * total lambda function runtime in milliseconds
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-case-declarations */
const FS = require('fs');
const AWS = require('aws-sdk');

/**
 * @function usage
 * @description print usage
 * @param {string} [message] error message
 */
function usage(message) {
  if (message) {
    console.error(`ERROR: ${message}`);
  }

  console.log(`
Usage:
node execution-summary.js --arn <execution-arn>

where:
  execution-arn   [mandatory] arn of the state machine
  `);
}

/**
 * @function parseCmdline
 * @description parse commandline options
 */
function parseCmdline() {
  const options = {};
  const args = process.argv.slice(2);
  while (args.length) {
    options[args.shift()] = args.shift();
  }
  return options;
}

function popTaskHistory(event, lambda) {
  const {
    previousEventId,
    stateExitedEventDetails: {
      name,
    },
  } = event;

  const executions = {};
  let resource;
  let task = event;
  do {
    const idx = lambda.findIndex(x => x.id === task.previousEventId); // eslint-disable-line
    if (idx < 0) {
      throw new Error(`failed to find task id (${previousEventId}), ${name}`);
    }
    task = lambda.splice(idx, 1).shift();
    if (task.type === 'LambdaFunctionScheduled') {
      resource = task.lambdaFunctionScheduledEventDetails.resource.split(':').pop();
    } else if (task.type === 'LambdaFunctionStarted') {
      executions.startTime = new Date(task.timestamp).getTime();
    } else if (task.type === 'LambdaFunctionSucceeded') {
      executions.endTime = new Date(task.timestamp).getTime();
    }
  } while (task.type !== 'TaskStateEntered');

  return {
    name,
    resource,
    executions,
  };
}

/**
 * @function parseExecutionHistory
 * @description parse state machine execution history
 * @param {string} arn
 */
async function parseExecutionHistory(arn) {
  const step = new AWS.StepFunctions({
    apiVersion: '2016-11-23',
  });

  let transitions = 0;
  const tasks = {};
  const lambdas = [];
  let response;

  do {
    response = await step.getExecutionHistory({
      executionArn: arn,
      maxResults: 100,
      nextToken: (response || {}).nextToken,
      reverseOrder: false,
    }).promise();

    while (response.events.length) {
      const event = response.events.shift();
      if (/Entered$/.test(event.type)) {
        transitions += 1;
      }

      switch (event.type) {
        case 'TaskStateEntered':
          lambdas.push(event);
          break;
        case 'LambdaFunctionScheduled':
        case 'LambdaFunctionStarted':
        case 'LambdaFunctionSucceeded':
          lambdas.push(event);
          break;
        case 'TaskStateExited':
          const {
            name,
            resource,
            executions,
          } = popTaskHistory(event, lambdas);
          tasks[name] = tasks[name] || {};
          tasks[name].resource = resource;
          tasks[name].executions = tasks[name].executions || [];
          tasks[name].executions.push(executions);
          break;
        default:
          break;
      }
    }
  } while ((response || {}).nextToken);

  let resources = [...new Set(Object.keys(tasks).map(x => tasks[x].resource))];

  const lambda = new AWS.Lambda({
    apiVersion: '2015-03-31',
  });

  resources = await Promise.all(resources.map(x =>
    lambda.getFunctionConfiguration({
      FunctionName: x,
    }).promise()));

  const lambdaExecutions = {};
  while (resources.length) {
    const res = resources.shift();
    lambdaExecutions[res.FunctionName] = Object.assign({}, lambdaExecutions[res.FunctionName], {
      memorySize: res.MemorySize,
      elapsed: Object.keys(tasks).filter(x =>
        tasks[x].resource === res.FunctionName).reduce((a0, c0) =>
        a0 + tasks[c0].executions.reduce((a1, c1) =>
          a1 + c1.endTime - c1.startTime, 0), 0),
    });
  }

  return {
    summary: {
      transitions,
      lambdaExecutions,
    },
    details: tasks,
  };
}

function saveCSV(name, data) {
  const report = [];
  report.push('"Summary"');
  report.push('"Total transitions"');
  report.push(`${data.summary.transitions}`);
  report.push('');
  report.push('"Lambda","Memory size (MB)","Total executions (ms)"');
  Object.keys(data.summary.lambdaExecutions).forEach((x) => {
    report.push(`"${x}",${data.summary.lambdaExecutions[x].memorySize},${data.summary.lambdaExecutions[x].elapsed}`);
  });

  report.push('');
  report.push('"Details"');
  report.push('"State","Resource","Invocation counts","Total executions (ms)"');
  Object.keys(data.details).forEach((x) => {
    const elapsed = data.details[x].executions.reduce((a0, c0) =>
      a0 + c0.endTime - c0.startTime, 0);
    report.push(`"${x}","${data.details[x].resource}",${data.details[x].executions.length},${elapsed}`);
  });
  FS.writeFileSync(name, report.join('\n'));
  console.log(report.join('\n'));
}

/**
 * @description sample code to generate summary of execution
 */
(async () => {
  const options = parseCmdline();
  if (!options['--arn']) {
    usage('missing --arn');
    return;
  }

  const result = await parseExecutionHistory(options['--arn']);

  const tmp = options['--arn'].split(':');
  let name = tmp.pop();
  name = `summary-${tmp.pop()}-${name}.csv`;
  saveCSV(name, result);
  // console.log(JSON.stringify(result, null, 2));
})();
