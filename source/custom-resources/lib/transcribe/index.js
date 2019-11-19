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
 * @function CreateCustomVocabulary
 * @param {object} event
 * @param {object} context
 */
exports.CreateCustomVocabulary = async (event, context) => {
  try {
    const {
      Vocabulary,
    } = require('./vocabulary');

    const instance = new Vocabulary(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `Vocabulary: ${e.message}`;
    throw e;
  }
};
