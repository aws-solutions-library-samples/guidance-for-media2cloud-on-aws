// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  MediaConvertClient,
  DescribeEndpointsCommand,
  ResourceNotFoundException,
} = require('@aws-sdk/client-mediaconvert');
const {
  xraysdkHelper,
  retryStrategyHelper,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

/**
 * @function MediaConvertEndpoint
 * @param {object} event
 * @param {object} context
 */
exports.MediaConvertEndpoint = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    /* not handle Delete event */
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const mediaconvertClient = xraysdkHelper(new MediaConvertClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DescribeEndpointsCommand({
      MaxResults: 1,
    });

    return mediaconvertClient.send(command)
      .then((res) => {
        const url = ((res.Endpoints || [])[0] || {}).Url;
        if (!url) {
          throw new ResourceNotFoundException('fail to get endpoint');
        }
        x0.storeResponseData('Endpoint', url);
        x0.storeResponseData('Status', 'SUCCESS');
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'MediaConvertEndpoint:',
      'DescribeEndpointsCommand:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );
    throw e;
  }
};
