// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  SFNClient,
  DescribeExecutionCommand,
} = require('@aws-sdk/client-sfn');
const {
  CommonUtils,
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class StepOp extends BaseOp {
  async onPOST() {
    throw new M2CException('StepOp.onPOST not impl');
  }

  async onDELETE() {
    throw new M2CException('StepOp.onDELETE not impl');
  }

  async onGET() {
    let executionArn = (this.request.queryString || {}).executionArn;
    if (!executionArn) {
      throw new M2CException('missing executionArn');
    }
    executionArn = decodeURIComponent(executionArn);

    if (!CommonUtils.validateStateMachineArn(executionArn)) {
      throw new M2CException('invalid executionArn');
    }

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DescribeExecutionCommand({
      executionArn,
    });

    const response = await stepfunctionClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));

    return super.onGET(response);
  }
}

module.exports = StepOp;
