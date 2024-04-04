// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SFNClient,
  DescribeExecutionCommand,
} = require('@aws-sdk/client-sfn');
const {
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
  xraysdkHelper,
  retryStrategyHelper,
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

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DescribeExecutionCommand({
      executionArn: this.executionArn,
    });

    const response = await stepfunctionClient.send(command)
      .then((res) => {
        if (res.output) {
          const parsed = JSON.parse(res.output) || {};
          return {
            stateMachineOutput: (parsed.output || {})[state],
          };
        }
        return undefined;
      })
      .catch(() =>
        undefined);

    const backlog = new CustomBacklogJob();

    return backlog.deleteJob(
      this.executionArn,
      this.status,
      response
    );
  }
}

module.exports = CustomLabelsStateMachineStatus;
