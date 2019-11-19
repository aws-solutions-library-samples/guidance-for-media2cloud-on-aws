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
 * @function send
 * @description dispatch message to SNS topic to notify MAM and/or downstream workflow
 * @param {object} event
 */
exports.send = async (subject, message, TopicArn = Environment.SNS.Topic) => {
  try {
    if (!TopicArn) {
      throw new Error('TopicArn not defined');
    }

    /* subject line can't be more than 100 characters */
    const Subject = (subject.length > 100)
      ? `${subject.slice(0, 97)}...`
      : subject;

    const Message = (typeof message === 'string') ? message : JSON.stringify(message, null, 2);

    const sns = new AWS.SNS({
      apiVersion: '2010-03-31',
    });

    await sns.publish({
      Subject,
      Message,
      TopicArn,
    }).promise();

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};
