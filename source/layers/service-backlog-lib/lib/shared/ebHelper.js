// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  EventBridgeClient,
  PutEventsCommand,
} = require('@aws-sdk/client-eventbridge');
const {
  EventBridge: EB,
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('./defs');
const xraysdkHelper = require('./xraysdkHelper');
const retryStrategyHelper = require('./retryStrategyHelper');
const {
  M2CException,
} = require('./error');

class EBHelper {
  static async send(
    message,
    bus = EB.Bus,
    source = EB.Source,
    detailType = EB.DetailType
  ) {
    if (!bus || !source || !detailType) {
      throw new M2CException('bus, source, or detailType not defined');
    }
    if (!message) {
      throw new M2CException('message not defined');
    }

    let detail = message;
    if (typeof detail !== 'string') {
      detail = JSON.stringify(detail);
    }

    const params = {
      Entries: [{
        EventBusName: bus,
        Source: source,
        DetailType: detailType,
        Detail: detail,
      }],
    };

    const eventbridgeClient = xraysdkHelper(new EventBridgeClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PutEventsCommand(params);

    return eventbridgeClient.send(command)
      .then(() =>
        message)
      .catch((e) => {
        console.error(
          'ERR:',
          'EBHelper.send:',
          'PutEventsCommand:',
          e.$metadata.httpStatusCode,
          e.name,
          JSON.stringify(params)
        );
        return undefined;
      });
  }
}

module.exports = EBHelper;
