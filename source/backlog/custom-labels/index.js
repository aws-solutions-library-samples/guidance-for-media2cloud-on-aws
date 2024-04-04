// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment: {
    StateMachines: {
      States,
    },
  },
  M2CException,
} = require('service-backlog-lib');
const StateCheckProjectVersionStatus = require('./states/check-project-version-status');
const StateStartProjectVersion = require('./states/start-project-version');
const StateDetectCustomLabels = require('./states/detect-custom-labels');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_BACKLOG_EB_BUS',
  'ENV_BACKLOG_TABLE',
  'ENV_ATOMICLOCK_TABLE',
];

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
  let handler;
  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new M2CException(`missing enviroment variables, ${missing.join(', ')}`);
    }
    if (event.operation === States.CheckProjectVersionStatus) {
      handler = new StateCheckProjectVersionStatus(event, context);
    } else if (event.operation === States.StartProjectVersion) {
      handler = new StateStartProjectVersion(event, context);
    } else if (event.operation === States.DetectCustomLabels) {
      handler = new StateDetectCustomLabels(event, context);
    } else {
      throw new M2CException(`${event.operation} not impl`);
    }
    return handler.process();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
