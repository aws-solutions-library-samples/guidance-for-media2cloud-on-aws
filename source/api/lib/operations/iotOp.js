// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  IoTClient,
  AttachPolicyCommand,
} = require('@aws-sdk/client-iot');
const {
  StateData,
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class IotOp extends BaseOp {
  async onGET() {
    throw new M2CException('IotOp.onGET not impl');
  }

  async onDELETE() {
    throw new M2CException('IotOp.onDELETE not impl');
  }

  async onPOST() {
    if (!this.request.cognitoIdentityId) {
      throw new M2CException('invalid user id');
    }
    const iotClient = xraysdkHelper(new IoTClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new AttachPolicyCommand({
      policyName: Environment.Iot.PolicyName,
      target: this.request.cognitoIdentityId,
    });

    const response = await iotClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));

    return super.onPOST({
      status: StateData.Statuses.Completed,
      ...response,
    });
  }
}

module.exports = IotOp;
