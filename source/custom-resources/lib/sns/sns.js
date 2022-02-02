// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const mxBaseResponse = require('../shared/mxBaseResponse');

class SNS extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);
    /* sanity check */
    const data = event.ResourceProperties.Data;
    this.sanityCheck(data);
    this.$data = data;
    /* create unique email list */
    const list = (Array.isArray(data.EmailList)
      ? data.EmailList.slice(0)
      : data.EmailList.split(','))
      .filter(x => x).map(x => x.trim());
    this.$emailList = Array.from(new Set(list));
  }

  sanityCheck(data) {
    const missing = [
      'EmailList',
      'TopicArn',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
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

    const sns = new AWS.SNS({
      apiVersion: '2010-03-31',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    const response = await Promise.all(this.emailList.map(email =>
      sns.subscribe({
        Protocol: 'email',
        TopicArn: this.topicArn,
        Endpoint: email,
      }).promise()));

    this.storeResponseData('Subscribed', response.length);
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
