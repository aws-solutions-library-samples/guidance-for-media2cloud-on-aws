/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable global-require */
/* eslint-disable max-classes-per-file */
const {
  BaseIndex,
} = require('m2c-core-lib');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

/**
 * @function CreateIndex
 * @param {object} event
 * @param {object} context
 */
exports.CreateIndex = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}`);

  class X0 extends mxBaseResponse(class {}) {}
  const x0 = new X0(event, context);

  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const Props = (event || {}).ResourceProperties;
    if (!Props.DomainEndpoint || !Props.IndexName) {
      throw new Error('missing DomainEndpoint or IndexName');
    }

    const client = new BaseIndex(Props.DomainEndpoint);
    const response = await client.createIndex(Props.IndexName);

    console.log(`CreateIndex.response = ${JSON.stringify(response, null, 2)}`);

    x0.storeResponseData('IndexName', Props.IndexName);
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `CreateIndex: ${e.message}`;
    console.error(e);
    x0.storeResponseData('Status', 'FAILED');

    return x0.responseData;
  }
};
