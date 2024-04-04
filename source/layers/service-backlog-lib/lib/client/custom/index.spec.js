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
  DeleteItemCommand,
  QueryCommand,
  UpdateItemCommand,
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
  SFNClient,
  StartExecutionCommand,
} = require('@aws-sdk/client-sfn');
const {
  RekognitionClient,
  StopProjectVersionCommand,
} = require('@aws-sdk/client-rekognition');

const CustomBacklogJob = require('./index');

const ddbMock = mockClient(DynamoDBClient);
const rekognitionMock = mockClient(RekognitionClient);
const stepMock = mockClient(SFNClient);
const eventbridgeMock = mockClient(EventBridgeClient);

describe('Test CustomBacklogJob', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    ddbMock.reset();
    rekognitionMock.reset();
    stepMock.reset();
    eventbridgeMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Test startCustomLabelsDetection', async () => {
    const serviceApi = CustomBacklogJob.ServiceApis.StartCustomLabelsDetection;
    const serviceParams = {
      jobId: 'testCustomLabels',
      input: {
        projectVersionArn: 'arn:part:service:region:account:testArn',
      },
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    ddbMock.on(DeleteItemCommand)
      .resolves({});

    stepMock.on(StartExecutionCommand)
      .resolves({
        executionArn: serviceParams.jobId,
      });

    eventbridgeMock.on(PutEventsCommand)
      .resolves('sent');

    const customJob = new CustomBacklogJob();
    const response = await customJob.startCustomLabelsDetection(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test fetchAndStartJobs with one queued item', async () => {
    const serviceApi = CustomBacklogJob.ServiceApis.StartCustomLabelsDetection;
    const serviceParams = {
      jobId: 'testCustomLabels',
      input: {
        projectVersionArn: 'arn:part:service:region:account:testArn',
      },
    };

    const prev = {
      id: 'itemId',
      serviceParams,
    };

    const queryResponse = {
      Items: [
        marshall({
          ...prev,
          serviceApi,
        }),
      ],
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    ddbMock.on(DeleteItemCommand)
      .resolves({});

    ddbMock.on(QueryCommand)
      .resolves(queryResponse);

    ddbMock.on(UpdateItemCommand)
      .resolves({});

    stepMock.on(StartExecutionCommand)
      .resolves({
        executionArn: serviceParams.jobId,
      });

    eventbridgeMock.on(PutEventsCommand)
      .resolves('sent');

    const customJob = new CustomBacklogJob();

    const response = await customJob.fetchAndStartJobs(
      serviceApi,
      prev
    );

    expect(response.started[0])
      .toBe(prev.id);

    expect(response.total)
      .toBe(queryResponse.Items.length);
  });

  test('Test fetchAndStartJobs with no item', async () => {
    const serviceApi = CustomBacklogJob.ServiceApis.StartCustomLabelsDetection;
    const serviceParams = {
      jobId: 'testCustomLabels',
      input: {
        projectVersionArn: 'arn:part:service:region:account:testArn',
      },
    };

    const prev = {
      id: 'itemId',
      serviceParams,
    };

    const queryResponse = {
      Items: [],
    };

    rekognitionMock.on(StopProjectVersionCommand)
      .resolves({});

    ddbMock.on(QueryCommand)
      .resolves(queryResponse);

    eventbridgeMock.on(PutEventsCommand)
      .resolves('sent');

    const customJob = new CustomBacklogJob();

    const response = await customJob.fetchAndStartJobs(
      serviceApi,
      prev
    );

    expect(response.total)
      .toBe(0);
  });

  test('Test AtomicLockTable functions', async () => {
    const customJob = new CustomBacklogJob();
    const item = {
      serviceParams: {
        input: {
          projectVersionArn: 'beforeDeleteJob',
        },
      },
    };

    ddbMock.on(DeleteItemCommand)
      .resolves({});

    ddbMock.on(UpdateItemCommand)
      .resolves({});

    let response = await customJob.beforeDeleteJob(item, '');

    expect(response.serviceParams.input.projectVersionArn)
      .toBe(item.serviceParams.input.projectVersionArn);

    response = await CustomBacklogJob.updateTTL('updateTTL', 10);

    expect(response).toBe(true);
  });
});
