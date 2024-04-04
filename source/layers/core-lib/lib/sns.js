// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SNSClient,
  PublishCommand,
} = require('@aws-sdk/client-sns');
const Environment = require('./environment');
const xraysdkHelper = require('./xraysdkHelper');
const retryStrategyHelper = require('./retryStrategyHelper');

const SNS_TOPIC = Environment.SNS.Topic;
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class SNS {
  static trimSubject(subject) {
    return (subject.length > 100)
      ? `${subject.slice(0, 97)}...`
      : subject;
  }

  static async send(
    subject,
    message,
    topicArn = SNS_TOPIC
  ) {
    if (!topicArn) {
      return false;
    }

    let payload = message;
    if (!(typeof payload === 'string'
    || payload instanceof Buffer)) {
      payload = JSON.stringify(payload);
    }

    const trimmed = SNS.trimSubject(subject);

    const snsClient = xraysdkHelper(new SNSClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: trimmed,
      Message: payload,
    });

    return snsClient.send(command)
      .then(() =>
        true)
      .catch((e) => {
        console.error(
          'ERR:',
          'SNS.send:',
          'snsClient.send:',
          e.$metadata.httpStatusCode,
          e.name,
          payload
        );
        return false;
      });
  }
}

module.exports = SNS;
