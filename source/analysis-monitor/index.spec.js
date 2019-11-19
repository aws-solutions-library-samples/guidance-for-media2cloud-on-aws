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
const AWS = require('aws-sdk-mock'); // eslint-disable-line
const sinon = require('sinon');
const nock = require('nock'); // eslint-disable-line

const {
  expect,
} = require('chai');

describe('analysis state machine', async function () {
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

    const {
      IotStatus,
    } = require('m2c-core-lib');
    sinon.stub(IotStatus, 'publish').returns(true);
  });

  after(function () {
    delete console.log;
  });

  describe('#start-analysis', function () {
    before(function () {
      const {
        Analysis,
      } = require('./lib');

      sinon.stub(Analysis.prototype, 'startAnalysis').returns({
        uuid: 'uuid',
        operation: 'start-analysis',
        status: 'COMPLETED',
        next: {
          video: {
            arn: 'video-analysis-arn',
            status: 'STARTED',
          },
        },
      });
    });

    it('should return uuid, operation, progress, next', async function () {
      const Handler = require('./index');
      const response = await Handler.onAnalysisMonitor({
        uuid: 'uuid',
        operation: 'start-analysis',
        input: {
          aiOptions: {
            celeb: true,
          },
        },
      }, context);
      console.log(JSON.stringify(response, null, 2));

      expect(response).to.be.an('object').that.has.keys('uuid', 'operation', 'next', 'progress');
    });
  });
});
