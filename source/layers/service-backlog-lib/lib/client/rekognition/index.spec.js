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
  RekognitionClient,
  StartCelebrityRecognitionCommand,
  StartContentModerationCommand,
  StartFaceDetectionCommand,
  StartFaceSearchCommand,
  StartLabelDetectionCommand,
  StartPersonTrackingCommand,
  StartSegmentDetectionCommand,
  StartTextDetectionCommand,
} = require('@aws-sdk/client-rekognition');

const RekognitionBacklogJob = require('./index');

const ddbMock = mockClient(DynamoDBClient);
const rekognitionMock = mockClient(RekognitionClient);
const eventbridgeMock = mockClient(EventBridgeClient);

describe('Test RekognitionBacklogJob', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
    eventbridgeMock.on(PutEventsCommand)
      .resolves('sent');
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    ddbMock.reset();
    rekognitionMock.reset();
  });

  afterEach(() => {
  });

  test('Test startCelebrityRecognition', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartCelebrityRecognition;
    const serviceParams = {
      jobId: 'testCelebRekog',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartCelebrityRecognitionCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startCelebrityRecognition(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startContentModeration', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartContentModeration;
    const serviceParams = {
      jobId: 'testContentModeration',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartContentModerationCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startContentModeration(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startFaceDetection', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartFaceDetection;
    const serviceParams = {
      jobId: 'testFaceDetection',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartFaceDetectionCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startFaceDetection(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startFaceSearch', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartFaceSearch;
    const serviceParams = {
      jobId: 'testFaceSearch',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartFaceSearchCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startFaceSearch(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startLabelDetection', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartLabelDetection;
    const serviceParams = {
      jobId: 'testLabelDetection',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartLabelDetectionCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startLabelDetection(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startPersonTracking', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartPersonTracking;
    const serviceParams = {
      jobId: 'testPersonTracking',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartPersonTrackingCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startPersonTracking(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startSegmentDetection', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartSegmentDetection;
    const serviceParams = {
      jobId: 'testSegmentDetection',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartSegmentDetectionCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startSegmentDetection(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startTextDetection', async () => {
    const serviceApi = RekognitionBacklogJob.ServiceApis.StartTextDetection;
    const serviceParams = {
      jobId: 'textTextDetection',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    rekognitionMock.on(StartTextDetectionCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const rekognitionJob = new RekognitionBacklogJob();

    const response = await rekognitionJob.startTextDetection(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });
});
