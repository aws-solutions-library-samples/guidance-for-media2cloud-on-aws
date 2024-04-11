// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const mxBaseResponse = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

/**
 * @function CheckVersionCompatibilityStatement
 * @param {object} event
 * @param {object} context
 */
exports.CheckVersionCompatibilityStatement = async (event, context) => {
  const x0 = new X0(event, context);

  if (x0.isRequestType('Delete')) {
    x0.storeResponseData('Status', 'SKIPPED');
    return x0.responseData;
  }

  let consent = event.ResourceProperties.Data.VersionCompatibilityStatement || '';
  consent = consent.toLowerCase();

  if (consent.startsWith('yes')) {
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  }

  throw new Error('Unable to continue the stack creation due to version compatibility statement.');
};
