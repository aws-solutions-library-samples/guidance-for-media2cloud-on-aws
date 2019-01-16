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
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const AWS = require('aws-sdk');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

const REQUIRED_PROPERTIES = [
  'ServiceToken',
  'FunctionName',
  'EmailList',
  'TopicArn',
];

class SNS extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    const {
      ResourceProperties = {},
    } = event || {};

    /* sanity check */
    const missing = REQUIRED_PROPERTIES.filter(x => ResourceProperties[x] === undefined);

    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    const {
      TopicArn,
      EmailList,
    } = ResourceProperties;

    /* create unique email list */
    const list = EmailList.split(',').filter(x => x).map(x => x.trim());

    this.$emailList = Array.from(new Set(list));

    /* topic to subscribe */
    this.$topicArn = TopicArn;
  }

  get topicArn() {
    return this.$topicArn;
  }

  get emailList() {
    return this.$emailList;
  }

  /**
   * @function subscribe
   * @description subscribe a list of emails to SNS topic
   */
  async subscribe() {
    console.log(`EmailList = ${JSON.stringify(this.emailList, null, 2)}`);

    const sns = new AWS.SNS({
      apiVersion: '2010-03-31',
    });

    const promises = this.emailList.map(email =>
      sns.subscribe({
        Protocol: 'email',
        TopicArn: this.topicArn,
        Endpoint: email,
      }).promise());

    const response = await Promise.all(promises);

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

module.exports = {
  SNS,
};
