// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  Indexer,
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
    if (!data.DomainEndpoint) {
      throw new Error('missing DomainEndpoint');
    }

    const indexer = new Indexer(data.DomainEndpoint);
    const response = await indexer.batchCreateIndices();
    console.log(`Indexer.batchCreateIndices = ${JSON.stringify(response, null, 2)}`);

    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `CreateIndex: ${e.message}`;
    console.error(e);
    x0.storeResponseData('Status', 'FAILED');
    return x0.responseData;
  }
};
