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
  CommonUtils,
} = require('m2c-core-lib');

const {
  BaseOp,
} = require('./baseOp');

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
    });

    return super.onGET(await step.describeExecution({
      executionArn,
    }).promise());
  }
}

module.exports = {
  StepOp,
};
