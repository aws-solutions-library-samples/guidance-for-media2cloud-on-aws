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
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');

const {
  Environment,
  StateData,
  CommonUtils,
} = require('m2c-core-lib');

const {
  BaseOp,
} = require('./baseOp');

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

module.exports = {
  LabelingOp,
};
