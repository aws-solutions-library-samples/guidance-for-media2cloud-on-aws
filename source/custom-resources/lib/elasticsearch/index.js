/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
const {
  BaseIndex,
} = require('core-lib');

const mxBaseResponse = require('../shared/mxBaseResponse');

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

    const data = event.ResourceProperties.Data;
    if (!data.DomainEndpoint || !data.IndexName) {
      throw new Error('missing DomainEndpoint or IndexName');
    }

    const client = new BaseIndex(data.DomainEndpoint);
    const response = await client.createIndex(data.IndexName);
    console.log(`CreateIndex.response = ${JSON.stringify(response, null, 2)}`);

    x0.storeResponseData('IndexName', data.IndexName);
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `CreateIndex: ${e.message}`;
    console.error(e);
    x0.storeResponseData('Status', 'FAILED');
    return x0.responseData;
  }
};
