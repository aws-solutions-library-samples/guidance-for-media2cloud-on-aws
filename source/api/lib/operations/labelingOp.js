/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const {
  Environment,
  StateData,
  CommonUtils,
} = require('core-lib');
const BaseOp = require('./baseOp');

class LabelingOp extends BaseOp {
  async onGET() {
    throw new Error('LabelingOp.onGET not impl');
  }

  async onDELETE() {
    throw new Error('LabelingOp.onDELETE not impl');
  }

  async onPOST() {
    const params = this.request.body || {};

    if (!params.uuid || !CommonUtils.validateUuid(params.uuid)) {
      throw new Error('invalid uuid');
    }

    const arn = [
      'arn:aws:states',
      process.env.AWS_REGION,
      this.request.accountId,
      'stateMachine',
      Environment.StateMachines.GroundTruth,
    ].join(':');

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    const response = await step.startExecution({
      input: JSON.stringify(params),
      stateMachineArn: arn,
    }).promise();

    return super.onPOST(Object.assign({
      uuid: params.uuid,
      status: StateData.Statuses.Started,
    }, response));
  }
}

module.exports = LabelingOp;
