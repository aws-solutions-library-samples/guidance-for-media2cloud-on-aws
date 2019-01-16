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
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');
const nock = require('nock');

const {
  expect,
} = require('chai');

const {
  MediaInfoCommand,
} = require('./mediainfo/mediaInfoCommand');

const {
  DB,
} = require('../shared/db');

const {
  DBConfig,
} = require('../shared/dbConfig');

const {
  GlacierAttributes,
} = require('../shared/videoAsset');

const {
  mxCommonUtils,
} = require('../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

describe('ingest-workflow', async function () {
  /* fixtures */
  /* dynamodb configuration */
  const dbConfiguration = require('./fixtures/dbConfigurationTable');
  /* divaObject */
  const divaObject = require('./fixtures/divaArchiveJson');
  /* mock response from MediaInfoCommand class */
  const responseMediaInfoCommand = require('./fixtures/mediainfoResponse');

  before(async function () {
    /* configure environment variables */
    process.env.ENV_QUIET = true;
    process.env.ENV_CONFIGURATION_TALBE = 'Configuration';
    process.env.ENV_CONFIGURATION_PARTITION_KEY = 'Item';
    process.env.ENV_CONFIGURATION_ITEM_NAME = 'configuration';

    AWS.mock('IotData', 'publish', function (_, callback) {
      callback(null, undefined);
    });

    sinon.stub(DB.prototype, 'update').returns(undefined);
  });

  describe('#onGlacierObjectCreated', function () {
    before(function () {
      sinon.stub(DBConfig, 'loadFromDB').returns(new DBConfig(dbConfiguration));
      sinon.stub(GlacierAttributes, 'loadFromDIVA').returns(divaObject);
      nock('https://x.execute-api.region.amazonaws.com')
        .post('/demo/ingest-statemachine')
        .reply(200, 'nock nock');
    });

    it('should not throw error', async function () {
      const event = require('./fixtures/s3ObjectCreatedEvent');
      const { onGlacierObjectCreated } = require('./preprocess/index');
      const response = await onGlacierObjectCreated(event, context);
      expect(response).to.be.an('undefined');
    });
  });

  describe('#generateMediaInfo', function () {
    before(function () {
      AWS.mock('S3', 'getSignedUrl', function (_, callback) {
        callback(null, 'https://glacier-bucket/some-signed-url');
      });
      sinon.stub(MediaInfoCommand.prototype, 'analyze').returns(responseMediaInfoCommand);
    });

    it('should return JSON response with `COMPLETED` status', async function () {
      /* test event */
      const event = {
        Service: 'aws.apigateway',
        State: 'apigateway',
        Status: 'STARTED',
        Progress: 1,
        StateMachine: 'ingest-statemachine',
        Timestamp: new Date().toISOString(),
        Data: {
          UUID: divaObject.UUID,
          Glacier: divaObject,
        },
        Config: dbConfiguration,
        DataInTransit: {},
      };

      const {
        generateMediaInfo,
      } = require('./mediainfo/index');

      const response = await generateMediaInfo(event, context);

      expect(response).to.be.an('object');
      expect(response.State).to.equal('mediainfo');
      expect(response.Status).to.equal('COMPLETED');
      expect(response.DataInTransit).to.be.an('object');
      expect(response.DataInTransit.container).to.be.an('object');
      expect(response.DataInTransit.video).to.be.instanceof(Array);
      expect(response.DataInTransit.audio).to.be.instanceof(Array);
    });
  });

  describe('#startTranscode', function () {
    before(function () {
      const mediaConvertResponse = require('./fixtures/mediaConvertResponse');

      AWS.mock('MediaConvert', 'createJob', function (_, callback) {
        callback(null, mediaConvertResponse);
      });
    });
    it('should return JSON response with `STARTED` status', async function () {
      /* test event */
      const event = {
        State: 'mediainfo',
        Status: 'COMPLETED',
        Progress: 100,
        StateMachine: 'ingest-statemachine',
        Timestamp: new Date().toISOString(),
        Data: {
          UUID: divaObject.UUID,
          Glacier: divaObject,
        },
        Config: dbConfiguration,
        DataInTransit: responseMediaInfoCommand,
      };

      const {
        startTranscode,
      } = require('./transcode/index');

      const response = await startTranscode(event, context);

      expect(response).to.be.an('object');
      expect(response.State).to.equal('transcode');
      expect(response.Status).to.equal('STARTED');
      expect(response.DataInTransit).to.be.an('object');
      expect(response.DataInTransit.TranscodeJobId).to.be.an('string');
      expect(response.DataInTransit.DurationInMs).to.be.an('number');
      expect(response.DataInTransit.BeginTime).to.be.an('number');
    });
  });

  describe('#getTranscodeStatus', function () {
    before(function () {
      const headObjectResponse = require('./fixtures/headObjectResponse');
      AWS.mock('S3', 'headObject', function (_, callback) {
        callback(null, headObjectResponse);
      });

      const mediaConvertResponse = require('./fixtures/mediaConvertResponse');
      mediaConvertResponse.Job.Status = 'COMPLETE';
      AWS.mock('MediaConvert', 'getJob', function (_, callback) {
        callback(null, mediaConvertResponse);
      });
    });

    it('should return JSON response with `COMPLETED` status', async function () {
      const event = {
        Service: 'aws.mediaconvert',
        State: 'transcode',
        Status: 'STARTED',
        Progress: 1,
        StateMachine: 'ingest-statemachine',
        Timestamp: new Date().toISOString(),
        Data: {
          UUID: divaObject.UUID,
          Glacier: divaObject,
        },
        Config: dbConfiguration,
        DataInTransit: {
          TranscodeJobId: X.zeroUUID(),
          DurationInMs: 10000,
          BeginTime: (new Date()).getTime(),
        },
      };
      const { getTranscodeStatus } = require('./transcode/index');
      const response = await getTranscodeStatus(event, context);

      expect(response).to.be.an('object');
      expect(response.State).to.equal('transcode');
      expect(response.Status).to.equal('COMPLETED');
      expect(response.DataInTransit).to.be.an('object');
      expect(response.DataInTransit.Proxy).to.be.an('object');
      expect(response.DataInTransit.Proxy.Key).to.be.an('string');
      expect(response.DataInTransit.Proxy.ImageKey).to.be.an('string');
    });
  });

  describe('#onIngestCompleted', function () {
    before(function () {
      /* don't care the response */
      AWS.mock('S3', 'putObjectTagging', function (_, callback) {
        callback(null, undefined);
      });
      /* return job data */
      const mediaConvertResponse = require('./fixtures/mediaConvertResponse');
      mediaConvertResponse.Job.Status = 'COMPLETE';
      AWS.mock('MediaConvert', 'getJob', function (_, callback) {
        callback(null, mediaConvertResponse);
      });
    });

    it('should return JSON response with `COMPLETED` status', async function () {
      const event = {
        Service: 'aws.mediaconvert',
        State: 'transcode',
        Status: 'COMPLETED',
        Progress: 100,
        StateMachine: 'ingest-statemachine',
        Timestamp: new Date().toISOString(),
        Data: {
          UUID: divaObject.UUID,
          Glacier: divaObject,
        },
        Config: dbConfiguration,
        DataInTransit: {
          TranscodeJobId: X.zeroUUID(),
          DurationInMs: 10000,
          BeginTime: (new Date()).getTime(),
          Proxy: {
            LastModified: new Date().toISOString(),
            ContentLength: 10,
            ContentType: 'video/mp4',
            Key: 'mock/video.mp4',
            AudioKey: 'mock/video.m4a',
            ImageKey: 'mock/thumbnail.jpg',
            LowresKey: 'mock/video_lowres.mp4',
          },
        },
      };
      const {
        onIngestCompleted,
      } = require('./postprocess/index');

      const response = await onIngestCompleted(event, context);

      expect(response).to.be.an('object');
      expect(response.State).to.equal('ingest');
      expect(response.Status).to.equal('COMPLETED');
    });
  });
});
