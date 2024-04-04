// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  M2CException,
} = require('core-lib');

// scene enhancement
const StateSceneEnhancement = require('./states/scene-enhancement');
// create scene taxonomy
const StateCreateSceneTaxonomy = require('./states/create-scene-taxonomy');
// ad-break detection
const StateAdBreakDetection = require('./states/ad-break');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_SOLUTION_UUID',
  'ENV_PROXY_BUCKET',
];

exports.handler = async (event, context) => {
  console.log(JSON.stringify(event, null, 2));
  console.log(JSON.stringify(context, null, 2));

  try {
    const missing = REQUIRED_ENVS
      .filter((x) =>
        process.env[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing enviroment variables, ${missing.join(', ')}`);
    }

    // routing
    let instance;

    if (StateSceneEnhancement.opSupported(event.operation)) {
      instance = new StateSceneEnhancement(event, context);
    } else if (StateCreateSceneTaxonomy.opSupported(event.operation)) {
      instance = new StateCreateSceneTaxonomy(event, context);
    } else if (StateAdBreakDetection.opSupported(event.operation)) {
      instance = new StateAdBreakDetection(event, context);
    } else {
      throw new M2CException('invalid state');
    }

    return instance.process();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
