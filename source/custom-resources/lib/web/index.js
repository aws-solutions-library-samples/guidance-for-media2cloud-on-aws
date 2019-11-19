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
 * @function CopyWebContent
 * @param {object} event
 * @param {object} context
 */
exports.CopyWebContent = async (event, context) => {
  try {
    const {
      WebContent,
    } = require('./web');

    const instance = new WebContent(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `CopyWebContent: ${e.message}`;
    throw e;
  }
};

/**
 * @function UpdateManifest
 * @param {object} event
 * @param {object} context
 */
exports.UpdateManifest = async (event, context) => {
  try {
    const {
      SolutionManifest,
    } = require('./web');

    const instance = new SolutionManifest(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `UpdateManifest: ${e.message}`;
    throw e;
  }
};
