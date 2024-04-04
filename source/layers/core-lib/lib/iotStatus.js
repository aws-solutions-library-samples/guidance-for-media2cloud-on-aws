// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  IoTDataPlaneClient,
  PublishCommand,
} = require('@aws-sdk/client-iot-data-plane');
const Environment = require('./environment');
const xraysdkHelper = require('./xraysdkHelper');
const retryStrategyHelper = require('./retryStrategyHelper');

const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

/**
 * @class IotStatus
 */
class IotStatus {
  static createIotClient(iotHost) {
    let endpoint = iotHost;
    if (endpoint.indexOf('https://') < 0) {
      endpoint = `https://${endpoint}`;
    }

    const iotClient = xraysdkHelper(new IoTDataPlaneClient({
      customUserAgent: CUSTOM_USER_AGENT,
      endpoint,
      retryStrategy: retryStrategyHelper(),
    }));

    return iotClient;
  }

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

    let payload = message;
    if (!(typeof payload === 'string'
    || Array.isArray(payload)
    || message instanceof Buffer)) {
      payload = JSON.stringify(payload);
    }

    const iotClient = IotStatus.createIotClient(endpoint);

    const command = new PublishCommand({
      topic,
      payload,
      qos: 0,
    });

    return iotClient.send(command)
      .catch((e) => {
        console.error(
          'ERR:',
          'IotStatus.publish:',
          'iotClient.send:',
          e.$metadata.httpStatusCode,
          e.name,
          payload
        );
        return undefined;
      });
  }
}

module.exports = IotStatus;
