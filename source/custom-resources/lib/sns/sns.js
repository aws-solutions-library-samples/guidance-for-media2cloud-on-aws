// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SNSClient,
  SubscribeCommand,
} = require('@aws-sdk/client-sns');
const {
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

class SNS extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);
    /* sanity check */
    const data = event.ResourceProperties.Data;
    this.sanityCheck(data);
    this.$data = data;

    /* create unique email list */
    let unique = data.EmailList;
    if (!Array.isArray(unique)) {
      unique = unique.split(',');
    }
    this.$emailList = [
      ...new Set(unique
        .filter((x) =>
          x)
        .map((x) =>
          x.trim())),
    ];
  }

  sanityCheck(data) {
    const missing = [
      'EmailList',
      'TopicArn',
    ].filter((x) =>
      data[x] === undefined);
    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }
  }

  get data() {
    return this.$data;
  }

  get emailList() {
    return this.$emailList;
  }

  get topicArn() {
    return this.data.TopicArn;
  }

  /**
   * @function subscribe
   * @description subscribe a list of emails to SNS topic
   */
  async subscribe() {
    console.log(`EmailList = ${JSON.stringify(this.emailList, null, 2)}`);

    const responses = await Promise.all(this.emailList
      .map((email) => {
        const snsClient = xraysdkHelper(new SNSClient({
          customUserAgent: CUSTOM_USER_AGENT,
          retryStrategy: retryStrategyHelper(),
        }));

        const command = new SubscribeCommand({
          Protocol: 'email',
          TopicArn: this.topicArn,
          Endpoint: email,
        });
        return snsClient.send(command);
      }));

    this.storeResponseData('Subscribed', responses.length);
    this.storeResponseData('Status', 'SUCCESS');
    return this.responseData;
  }

  /**
   * @function unsubscribe
   * @description not implememted (not needed)
   */
  async unsubscribe() {
    this.storeResponseData('Unsubscribed', 0);
    this.storeResponseData('Status', 'SKIPPED');

    return this.responseData;
  }
}

module.exports = SNS;
