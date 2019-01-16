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
 * @function SetNotification
 * @param {object} event
 * @param {object} context
 */
exports.SetNotification = async (event, context) => {
  try {
    const {
      S3Notification,
    } = require('./s3ex');

    const instance = new S3Notification(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `SetNotification: ${e.message}`;
    throw e;
  }
};

/**
 * @function SetCORS
 * @param {object} event
 * @param {object} context
 */
exports.SetCORS = async (event, context) => {
  try {
    const {
      S3Cors,
    } = require('./s3ex');

    const instance = new S3Cors(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `SetCORS: ${e.message}`;
    throw e;
  }
};

/**
 * @function SetLifecyclePolicy
 * @param {object} event
 * @param {object} context
 */
exports.SetLifecyclePolicy = async (event, context) => {
  try {
    const {
      S3LifecyclePolicy,
    } = require('./s3ex');

    const instance = new S3LifecyclePolicy(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `SetLifecyclePolicy: ${e.message}`;
    throw e;
  }
};
