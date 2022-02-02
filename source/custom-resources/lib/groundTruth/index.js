// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * @function ConfigureWorkteam
 * @param {object} event
 * @param {object} context
 */
exports.ConfigureWorkteam = async (event, context) => {
  try {
    const WorkTeam = require('./workTeam');

    const instance = new WorkTeam(event, context);
    if (instance.isRequestType('Delete')) {
      return instance.deleteResource();
    }
    if (instance.isRequestType('Update')) {
      return instance.updateResource();
    }
    return instance.createResource();
  } catch (e) {
    e.message = `ConfigureWorkteam: ${e.message}`;
    throw e;
  }
};
