// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SNS,
  M2CException,
} = require('core-lib');
const CloudWatchStatus = require('./lib/cloudwatch');
const DDBStreamEvent = require('./lib/ddbstream');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_ID',
  'ENV_RESOURCE_PREFIX',
  'ENV_SOLUTION_UUID',
  'ENV_ANONYMOUS_USAGE',
  'ENV_IOT_HOST',
  'ENV_IOT_TOPIC',
  'ENV_INGEST_BUCKET',
  'ENV_PROXY_BUCKET',
  'ENV_SNS_TOPIC_ARN',
  'ENV_ES_DOMAIN_ENDPOINT',
];

const DDB_STREAM_SOURCE = 'aws:dynamodb';

/**
 * @exports handler
 */
exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}; context = ${JSON.stringify(context, null, 2)};`);
  try {
    const missing = REQUIRED_ENVS.filter(x =>
      process.env[x] === undefined);
    if (missing.length) {
      throw new M2CException(`missing env, ${missing.join(', ')}`);
    }
    let instance;
    if (event.source) {
      instance = new CloudWatchStatus(event, context);
    } else if (event.Records && event.Records[0].eventSource === DDB_STREAM_SOURCE) {
      instance = new DDBStreamEvent(event, context);
    } else {
      throw new M2CException('event not supported. exiting....');
    }
    return instance.process();
  } catch (e) {
    console.error(e);
    return SNS.send('error: fail to handle event', `${e.message}\n\n${JSON.stringify(event, null, 2)}`).catch(() => false);
  }
};
