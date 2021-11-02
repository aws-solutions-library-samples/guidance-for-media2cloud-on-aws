// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  Retry,
  BacklogClient: {
    CustomBacklogJob,
  },
  Environment: {
    StateMachines: {
      States,
    },
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
} = require('service-backlog-lib');

class CustomLabelsStateMachineStatus {
  constructor(parent) {
    this.$parent = parent;
  }

  static get SourceType() {
    return 'aws.states';
  }

  get parent() {
    return this.$parent;
  }

  get event() {
    return this.parent.event;
  }

  get context() {
    return this.parent.context;
  }

  get detail() {
    return this.parent.detail;
  }

  get status() {
    return this.detail.status;
  }

  get executionArn() {
    return this.detail.executionArn;
  }

  async process() {
    /* mesh state machine output that gets passsed to EventBridge */
    const state = States.DetectCustomLabels;
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
      customUserAgent: CustomUserAgent,
    });
    const fn = step.describeExecution.bind(step);
    const output = await Retry.run(fn, {
      executionArn: this.executionArn,
    }).then(data =>
      ((data.output)
        ? {
          stateMachineOutput: ((JSON.parse(data.output) || {}).output || {})[state],
        }
        : undefined))
      .catch(() => undefined);
    const backlog = new CustomBacklogJob();
    return backlog.deleteJob(this.executionArn, this.status, output);
  }
}

module.exports = CustomLabelsStateMachineStatus;
