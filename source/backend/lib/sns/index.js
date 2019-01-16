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
 * @function send
 * @description dispatch message to SNS topic to notify MAM and/or downstream workflow
 * @param {object} event
 */
exports.send = async (Subject, message) => {
  try {
    const TopicArn = process.env.ENV_SNS_TOPIC_ARN;
    if (!TopicArn) {
      throw new Error('ENV_SNS_TOPIC_ARN not defined');
    }

    const Message = (typeof message === 'string') ? message : JSON.stringify(message, null, 2);

    const params = {
      Subject,
      Message,
      TopicArn,
    };

    const sns = new AWS.SNS({
      apiVersion: '2010-03-31',
    });

    await sns.publish(params).promise();

    return true;
  } catch (e) {
    process.env.ENV_QUIET || console.error(e);
    return false;
  }
};
