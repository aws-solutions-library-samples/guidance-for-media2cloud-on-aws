/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const {
  MediaConvert,
} = require('aws-sdk');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

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

    const instance = new MediaConvert({
      apiVersion: '2017-08-29',
    });

    const {
      Endpoints = [],
    } = await instance.describeEndpoints({
      MaxResults: 1,
    }).promise();

    /* sanity check the response */
    if (Endpoints.length === 0 || !Endpoints[0].Url) {
      throw new Error('failed to get endpoint');
    }

    x0.storeResponseData('Endpoint', Endpoints[0].Url);
    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `MediaConvertEndpoint: ${e.message}`;
    throw e;
  }
};
