/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * @function ConfigureWorkteam
 * @param {object} event
 * @param {object} context
 */
exports.ConfigureWorkteam = async (event, context) => {
  try {
    const {
      WorkTeam,
    } = require('./workTeam'); // eslint-disable-line

    const instance = new WorkTeam(event, context);

    let responseData;
    if (instance.isRequestType('Delete')) {
      responseData = await instance.deleteResource();
    } else if (instance.isRequestType('Update')) {
      responseData = await instance.updateResource();
    } else {
      responseData = await instance.createResource();
    }

    return responseData;
  } catch (e) {
    e.message = `ConfigureWorkteam: ${e.message}`;
    throw e;
  }
};
