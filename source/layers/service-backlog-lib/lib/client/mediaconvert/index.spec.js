// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  beforeAll,
  describe,
  expect,
} = require('@jest/globals');
const {
  DynamoDBClient,
  PutItemCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  marshall,
} = require('@aws-sdk/util-dynamodb');
const {
  EventBridgeClient,
  PutEventsCommand,
} = require('@aws-sdk/client-eventbridge');
const {
  mockClient,
} = require('aws-sdk-client-mock');
const {
  MediaConvertClient,
  CreateJobCommand,
} = require('@aws-sdk/client-mediaconvert');

const MediaConvertBacklogJob = require('./index');

const ddbMock = mockClient(DynamoDBClient);
const mediaconvertMock = mockClient(MediaConvertClient);
const eventbridgeMock = mockClient(EventBridgeClient);

describe('Test MediaConvertBacklogJob', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    ddbMock.reset();
    mediaconvertMock.reset();
    eventbridgeMock.reset();
  });

  afterEach(() => {
  });

  test('Test createJob', async () => {
    const serviceApi = MediaConvertBacklogJob.ServiceApis.CreateJob;
    const serviceParams = {
      jobId: 'testCreateJob',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    mediaconvertMock.on(CreateJobCommand)
      .resolves({
        Job: {
          Id: serviceParams.jobId,
        },
      });

    eventbridgeMock.on(PutEventsCommand)
      .resolves('sent');

    const mediaConvertJob = new MediaConvertBacklogJob();

    const response = await mediaConvertJob.createJob('id', serviceParams);

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });
});
