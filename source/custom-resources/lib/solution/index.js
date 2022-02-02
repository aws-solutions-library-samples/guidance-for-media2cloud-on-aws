// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  CommonUtils,
  Metrics,
} = require('core-lib');

const mxBaseResponse = require('../shared/mxBaseResponse');

/**
 * @function StringManipulation
 * @param {object} event
 * @param {object} context
 */
exports.CreateSolutionUuid = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }
    x0.storeResponseData('Uuid', CommonUtils.uuid4());
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `CreateSolutionUuid: ${e.message}`;
    throw e;
  }
};

/**
 * @function SendConfig
 * @description send template configuration to Solution Builder team
 */
exports.SendConfig = async (event, context) => {
  class X0 extends mxBaseResponse(class {}) {}
  const x0 = new X0(event, context);
  try {
    const data = event.ResourceProperties.Data;
    const key = (x0.isRequestType('Delete')) ? 'Deleted' : 'Launch';
    const cluster = data.ElasticsearchCluster || data.OpenSearchCluster;
    const matched = cluster.match(/([a-zA-z0-9 ]+)\s\(([a-zA-Z0-9.=,]+)\)/);
    if (matched) {
      const config = matched[2].split(',').map(x => {
        const a0 = x.split('=');
        return {
          [a0[0]]: Number.parseInt(a0[1], 10),
        };
      }).reduce((a0, c0) => ({
        ...a0,
        ...c0,
      }), {
        desc: matched[1].trim(),
      });
      console.log(`ElasticsearchClusterConfig = ${JSON.stringify(config, null, 2)}`);
    }
    const env = {
      Solution: data.SolutionId,
      UUID: data.SolutionUuid,
    };
    const params = {
      Version: data.Version,
      Metrics: data.AnonymousUsage,
      SearchEngine: cluster,
      [key]: (new Date()).toISOString().replace('T', ' ').replace('Z', ''),
    };
    console.log(`sendAnonymousData = ${JSON.stringify(params, null, 2)}`);
    const response = await Metrics.sendAnonymousData(params, env);
    console.log(`sendAnonymousData = ${response.toString()}`);
    x0.storeResponseData('Status', 'SUCCESS');
  } catch (e) {
    console.log(`SendConfig: ${e.message}`);
    x0.storeResponseData('Status', 'SKIPPED');
    x0.storeResponseData('Reason', e.message);
  }
  return x0.responseData;
};
