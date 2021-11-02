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
  CommonUtils,
  Environment,
} = require('core-lib');
const BaseOp = require('./baseOp');

class StepOp extends BaseOp {
  async onPOST() {
    throw new Error('StepOp.onPOST not impl');
  }

  async onDELETE() {
    throw new Error('StepOp.onDELETE not impl');
  }

  async onGET() {
    let executionArn = (this.request.queryString || {}).executionArn;
    if (!executionArn) {
      throw new Error('missing executionArn');
    }
    executionArn = decodeURIComponent(executionArn);

    if (!CommonUtils.validateStateMachineArn(executionArn)) {
      throw new Error('invalid executionArn');
    }

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    return super.onGET(await step.describeExecution({
      executionArn,
    }).promise());
  }
}

module.exports = StepOp;
