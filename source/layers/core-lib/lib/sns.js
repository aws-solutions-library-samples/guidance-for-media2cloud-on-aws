// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

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

class SNS {
  static trimSubject(subject) {
    return (subject.length > 100)
      ? `${subject.slice(0, 97)}...`
      : subject;
  }

  static async send(subject, message, topicArn = Environment.SNS.Topic) {
    if (!topicArn) {
      return false;
    }

    const params = {
      TopicArn: topicArn,
      Subject: SNS.trimSubject(subject),
      Message: (typeof message === 'string')
        ? message
        : JSON.stringify(message, null, 2),
    };

    const sns = new AWS.SNS({
      apiVersion: '2010-03-31',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    return sns.publish(params).promise()
      .then(() => true)
      .catch((e) => {
        console.error(e);
        return false;
      });
  }
}

module.exports = SNS;
