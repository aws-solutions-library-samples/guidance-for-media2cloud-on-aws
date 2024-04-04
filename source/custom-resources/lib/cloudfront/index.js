// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  CloudFrontClient,
  CreateInvalidationCommand,
} = require('@aws-sdk/client-cloudfront');
const {
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

/**
 * @function InvalidateCache
 * @param {object} event
 * @param {object} context
 */
exports.InvalidateCache = async (event, context) => {
  let x0;

  try {
    x0 = new X0(event, context);

    if (!x0.isRequestType('Update')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data;
    const missing = [
      'DistributionId',
      'Paths',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    const reference = (data.LastUpdated || new Date().toISOString())
      .replace(/[^0-9]/g, '');

    const cloudfrontClient = xraysdkHelper(new CloudFrontClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new CreateInvalidationCommand({
      DistributionId: data.DistributionId,
      InvalidationBatch: {
        CallerReference: reference,
        Paths: {
          Items: data.Paths,
          Quantity: data.Paths.length,
        },
      },
    });

    return cloudfrontClient.send(command)
      .then((res) => {
        x0.storeResponseData('Id', res.Invalidation.Id);
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'InvalidateCache:',
      'CreateInvalidationCommand:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );

    x0.storeResponseData('Id', 'None');
    return x0.responseData;
  }
};
