// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * @function EmailSubscribe
 * @param {object} event
 * @param {object} context
 */
exports.EmailSubscribe = async (event, context) => {
  try {
    const SNS = require('./sns');

    const sns = new SNS(event, context);

    return sns.isRequestType('Delete')
      ? sns.unsubscribe()
      : sns.subscribe();
  } catch (e) {
    e.message = `EmailSubscribe: ${e.message}`;
    throw e;
  }
};
