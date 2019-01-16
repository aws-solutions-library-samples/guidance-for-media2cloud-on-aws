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
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');

/**
 * @class IotStatus
 */
class IotStatus {
  static async publish(endpoint, topic, message) {
    try {
      const iotData = new AWS.IotData({
        apiVersion: '2015-05-28',
        endpoint,
      });

      /* payload supports string, Typed Array, or Buffer */
      const payload = (typeof message === 'string' || Array.isArray(message) || message instanceof Buffer)
        ? message
        : JSON.stringify(message);

      const params = {
        topic,
        payload,
        qos: 0,
      };
      process.env.ENV_QUIET || console.log(`IotStatus.publish = ${JSON.stringify(params, null, 2)}`);

      await iotData.publish(params).promise().catch((e) => {
        process.env.ENV_QUIET || console.error(e);
        return undefined;
      });
    } catch (e) {
      const err = new Error(`${e.statusCode} ${e.code} ${e.message}`);
      process.env.ENV_QUIET || console.error(err);
    }
  }
}

module.exports = {
  IotStatus,
};
