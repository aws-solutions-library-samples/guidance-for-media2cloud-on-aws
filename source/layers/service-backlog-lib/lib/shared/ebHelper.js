// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const Retry = require('./retry');
const {
  EventBridge: EB,
} = require('./defs');

class EBHelper {
  static async send(
    message,
    bus = EB.Bus,
    source = EB.Source,
    detailType = EB.DetailType
  ) {
    if (!bus || !source || !detailType) {
      throw new Error('bus, source, or detailType not defined');
    }
    if (!message) {
      throw new Error('message not defined');
    }
    const detail = (typeof message === 'string')
      ? message
      : JSON.stringify(message);
    const params = {
      Entries: [{
        EventBusName: bus,
        Source: source,
        DetailType: detailType,
        Detail: detail,
      }],
    };
    const eb = new AWS.EventBridge({
      apiVersion: '2015-10-07',
    });
    console.log(`EBHelper.putEvents = ${JSON.stringify(params, null, 2)}`);
    return Retry.run(eb.putEvents.bind(eb), params)
      .catch((e) => {
        console.error(`EBHelper.putEvents: ${e.message}`);
        return undefined;
      })
      .then(() => message);
  }
}

module.exports = EBHelper;
