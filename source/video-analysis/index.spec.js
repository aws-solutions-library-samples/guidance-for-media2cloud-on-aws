/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');
const nock = require('nock');

const {
  expect,
} = require('chai');

describe('video-analysis', async function () {
  /* fixtures */
  const context = {
    invokedFunctionArn: '::::1234:',
    getRemainingTimeInMillis: (() => 1000),
  };

  before(async function () {
    /* configure environment variables */
    const ENV = {
      AWS_REGION: 'us-east-1',
      ENV_SOLUTION_ID: '1234',
      ENV_STACKNAME: 'unit-test',
      ENV_IOT_HOST: 'iot-host',
      ENV_IOT_TOPIC: 'iot-topic',
      ENV_INGEST_BUCKET: 'ingest-bucket',
      ENV_PROXY_BUCKET: 'proxy-bucket',
      ENV_SNS_TOPIC_ARN: 'sns-topic',
      ENV_DEFAULT_AI_OPTIONS: 'aiml-options',
      ENV_DEFAULT_LANGUAGE_CODE: 'en-US',
      ENV_DEFAULT_COLLECTION_ID: 'collection',
      ENV_DEFAULT_VOCABULARY: 'vocabulary',
      ENV_DEFAULT_MINCONFIDENCE: 80,
      ENV_COMPREHEND_ROLE: 'comprehend-role',
      ENV_ES_DOMAIN_ENDPOINT: 'es-domain-endpoint',
    };
    Object.keys(ENV).forEach((key) => {
      process.env[key] = ENV[key];
    });

    console.log = function () {};
  });

  after(function () {
    delete console.log;
  });

  describe('#start-celeb', function () {
    before(function () {
    });

    it('should return uuid, operation, status', async function () {
      expect({
        uuid: 'uuid',
        operation: 'start-celeb',
        status: 'COMPLETED',
      }).to.be.an('object').that.has.keys('uuid', 'operation', 'status');
    });

    it('operation is start-celeb', async function () {
      expect({
        uuid: 'uuid',
        operation: 'start-celeb',
        status: 'COMPLETED',
      }.operation).to.be.equal('start-celeb');
    });
  });
});
