// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('aws-sdk');
  }
})();
const Environment = require('./environment');

/**
 * @class IotStatus
 */
class IotStatus {
  static async publish(...args) {
    const [
      endpoint,
      topic,
      message,
    ] = (args.length === 3) ? args : [
      Environment.Iot.Host,
      Environment.Iot.Topic,
      args[0],
    ];

    const payload = (typeof message === 'string' || Array.isArray(message) || message instanceof Buffer)
      ? message
      : JSON.stringify(message);

    const iotData = new AWS.IotData({
      apiVersion: '2015-05-28',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
      endpoint,
    });

    return iotData.publish({
      topic,
      payload,
      qos: 0,
    }).promise().catch(e => console.error(e));
  }
}

module.exports = IotStatus;
