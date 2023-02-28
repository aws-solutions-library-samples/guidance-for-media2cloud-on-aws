// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const mxBaseResponse = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

/**
 * @function InvalidateCache
 * @param {object} event
 * @param {object} context
 */
exports.InvalidateCache = async (event, context) => {
  const x0 = new X0(event, context);
  try {
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
      throw new Error(`missing ${missing.join(', ')}`);
    }
    const reference = (data.LastUpdated || new Date().toISOString()).replace(/\D/g, '');
    const cf = new AWS.CloudFront({
      apiVersion: '2020-05-31',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    const id = await cf.createInvalidation({
      DistributionId: data.DistributionId,
      InvalidationBatch: {
        CallerReference: reference,
        Paths: {
          Items: data.Paths,
          Quantity: data.Paths.length,
        },
      },
    }).promise()
      .then(res => {
        console.log(`[INFO]: InvalidateCache: success: id=${res.Invalidation.Id} status=${res.Invalidation.Status}`);
        return res.Invalidation.Id;
      })
      .catch((e) => {
        console.error(`[ERR]: InvalidateCache: ${e.code} ${e.message}`);
      });
    x0.storeResponseData('Id', id || 'None');
    return x0.responseData;
  } catch (e) {
    e.message = `[ERR]: InvalidateCache: ${e.code} ${e.message}`;
    throw e;
  }
};
