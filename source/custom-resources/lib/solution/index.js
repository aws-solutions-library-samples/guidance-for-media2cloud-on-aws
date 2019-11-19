/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-extraneous-dependencies */
const {
  CommonUtils,
  Metrics,
} = require('m2c-core-lib');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

/**
 * @function StringManipulation
 * @param {object} event
 * @param {object} context
 */
exports.CreateSolutionUuid = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    x0.storeResponseData('Uuid', CommonUtils.uuid4());
    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `CreateSolutionUuid: ${e.message}`;
    throw e;
  }
};

/**
 * @function SendConfig
 * @description send template configuration to Solution Builder team
 */
exports.SendConfig = async (event, context) => {
  class X0 extends mxBaseResponse(class {}) {}
  const x0 = new X0(event, context);

  try {
    const key = (x0.isRequestType('Delete')) ? 'Deleted' : 'Launch';
    const Props = event.ResourceProperties || {};

    const data = {
      Version: Props.Version,
      Size: Props.ClusterSize,
      Metrics: Props.AnonymousUsage,
      [key]: (new Date()).toISOString().replace('T', ' ').replace('Z', ''),
    };
    console.log(`data = ${JSON.stringify(data, null, 2)}`);

    const env = {
      Solution: Props.SolutionId,
      UUID: Props.SolutionUuid,
    };
    console.log(`env = ${JSON.stringify(env, null, 2)}`);

    const response = await Metrics.sendAnonymousData(data, env);
    console.log(`response = ${JSON.stringify(response, null, 2)}`);

    x0.storeResponseData('Status', 'SUCCESS');
  } catch (e) {
    console.log(`SendConfig: ${e.message}`);
    x0.storeResponseData('Status', 'SKIPPED');
    x0.storeResponseData('Reason', e.message);
  }
  return x0.responseData;
};
