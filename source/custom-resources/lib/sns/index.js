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

/**
 * @function EmailSubscribe
 * @param {object} event
 * @param {object} context
 */
exports.EmailSubscribe = async (event, context) => {
  try {
    const {
      SNS,
    } = require('./sns');

    const instance = new SNS(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.unsubscribe()
      : await instance.subscribe();

    return responseData;
  } catch (e) {
    e.message = `EmailSubscribe: ${e.message}`;
    throw e;
  }
};
