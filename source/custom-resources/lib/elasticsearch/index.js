// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Indexer,
  M2CException,
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
      throw new M2CException('missing DomainEndpoint');
    }
    const bUseOpenSearchSeverless = (Number(data.UseOpenSearchServerless || 0) > 0);

    const indexer = new Indexer(
      data.DomainEndpoint,
      bUseOpenSearchSeverless
    );

    let response;
    // if index name and mappings exist, create an index with given data
    if (data.IndexName && data.Mappings) {
      response = await indexer.createIndex(
        data.IndexName,
        data.Mappings
      );
      console.log(`Indexer.createIndex = ${JSON.stringify(response, null, 2)}`);
    } else {
      response = await indexer.batchCreateIndices();
      console.log(`Indexer.batchCreateIndices = ${JSON.stringify(response, null, 2)}`);
    }

    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `CreateIndex: ${e.message}`;
    console.error(e);
    x0.storeResponseData('Status', 'FAILED');
    return x0.responseData;
  }
};
