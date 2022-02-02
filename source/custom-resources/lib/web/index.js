// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * @function CopyWebContent
 * @param {object} event
 * @param {object} context
 */
exports.CopyWebContent = async (event, context) => {
  try {
    const WebContent = require('./webcontent');

    const web = new WebContent(event, context);
    return web.isRequestType('delete')
      ? web.purge()
      : web.create();
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
    const SolutionManifest = require('./solutionManifest');

    const manifest = new SolutionManifest(event, context);
    return (manifest.isRequestType('delete'))
      ? manifest.purge()
      : manifest.create();
  } catch (e) {
    e.message = `UpdateManifest: ${e.message}`;
    throw e;
  }
};
