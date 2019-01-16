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
