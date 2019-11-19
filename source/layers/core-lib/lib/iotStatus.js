/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');

const {
  Environment,
} = require('./index');

/**
 * @class IotStatus
 */
class IotStatus {
  static async publish(...args) {
    try {
      const [
        endpoint,
        topic,
        message,
      ] = (args.length === 3) ? args : [
        Environment.Iot.Host,
        Environment.Iot.Topic,
        args[0],
      ];

      const iotData = new AWS.IotData({
        apiVersion: '2015-05-28',
        endpoint,
      });

      const payload = (typeof message === 'string' || Array.isArray(message) || message instanceof Buffer)
        ? message
        : JSON.stringify(message);

      const params = {
        topic,
        payload,
        qos: 0,
      };
      process.env.ENV_QUIET || console.log(`IotStatus.publish = ${JSON.stringify(params, null, 2)}`);

      await iotData.publish(params).promise();
    } catch (e) {
      const err = new Error(`${e.statusCode} ${e.code} ${e.message}`);
      console.error(err);
    }
  }
}

module.exports = {
  IotStatus,
};
