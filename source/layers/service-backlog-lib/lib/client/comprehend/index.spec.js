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
  ComprehendClient,
  StartDocumentClassificationJobCommand,
  StartDominantLanguageDetectionJobCommand,
  StartEntitiesDetectionJobCommand,
  StartKeyPhrasesDetectionJobCommand,
  StartSentimentDetectionJobCommand,
  StartTopicsDetectionJobCommand,
} = require('@aws-sdk/client-comprehend');

const ComprehendBacklogJob = require('./index');

const ddbMock = mockClient(DynamoDBClient);
const comprehendMock = mockClient(ComprehendClient);
const eventbridgeMock = mockClient(EventBridgeClient);

describe('Test ComprehendBacklogJob', () => {
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
    comprehendMock.reset();
  });

  afterEach(() => {
  });

  test('Test startDocumentClassificationJob', async () => {
    const serviceApi = ComprehendBacklogJob.ServiceApis.StartDocumentClassificationJob;
    const serviceParams = {
      jobId: 'testDocClassification',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    comprehendMock.on(StartDocumentClassificationJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const comprehendJob = new ComprehendBacklogJob();
    const response = await comprehendJob.startDocumentClassificationJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startDominantLanguageDetectionJob', async () => {
    const serviceApi = ComprehendBacklogJob.ServiceApis.StartDominantLanguageDetectionJob;
    const serviceParams = {
      jobId: 'testDominantLang',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    comprehendMock.on(StartDominantLanguageDetectionJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const comprehendJob = new ComprehendBacklogJob();
    const response = await comprehendJob.startDominantLanguageDetectionJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startEntitiesDetectionJob', async () => {
    const serviceApi = ComprehendBacklogJob.ServiceApis.StartEntitiesDetectionJob;
    const serviceParams = {
      jobId: 'testEntitiesDetect',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    comprehendMock.on(StartEntitiesDetectionJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const comprehendJob = new ComprehendBacklogJob();
    const response = await comprehendJob.startEntitiesDetectionJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startKeyPhrasesDetectionJob', async () => {
    const serviceApi = ComprehendBacklogJob.ServiceApis.StartKeyPhrasesDetectionJob;
    const serviceParams = {
      jobId: 'testKeyPhrases',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    comprehendMock.on(StartKeyPhrasesDetectionJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const comprehendJob = new ComprehendBacklogJob();
    const response = await comprehendJob.startKeyPhrasesDetectionJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startSentimentDetectionJob', async () => {
    const serviceApi = ComprehendBacklogJob.ServiceApis.StartSentimentDetectionJob;
    const serviceParams = {
      jobId: 'testSentimentDetect',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    comprehendMock.on(StartSentimentDetectionJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const comprehendJob = new ComprehendBacklogJob();
    const response = await comprehendJob.startSentimentDetectionJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startTopicsDetectionJob', async () => {
    const serviceApi = ComprehendBacklogJob.ServiceApis.StartTopicsDetectionJob;
    const serviceParams = {
      jobId: 'testTopicDetect',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    comprehendMock.on(StartTopicsDetectionJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const comprehendJob = new ComprehendBacklogJob();
    const response = await comprehendJob.startTopicsDetectionJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });
});
