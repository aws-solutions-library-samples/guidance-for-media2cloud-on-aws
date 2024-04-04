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
  TextractClient,
  StartDocumentAnalysisCommand,
  StartDocumentTextDetectionCommand,
} = require('@aws-sdk/client-textract');

const TextractBacklogJob = require('./index');

const ddbMock = mockClient(DynamoDBClient);
const textractMock = mockClient(TextractClient);
const eventbridgeMock = mockClient(EventBridgeClient);

describe('Test TextractBacklogJob', () => {
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
    textractMock.reset();
  });

  afterEach(() => {
  });

  test('Test startDocumentAnalysis', async () => {
    const serviceApi = TextractBacklogJob.ServiceApis.StartDocumentAnalysis;
    const serviceParams = {
      jobId: 'testDocAnalysis',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    textractMock.on(StartDocumentAnalysisCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const textractJob = new TextractBacklogJob();

    const response = await textractJob.startDocumentAnalysis(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startDocumentTextDetection', async () => {
    const serviceApi = TextractBacklogJob.ServiceApis.StartDocumentTextDetection;
    const serviceParams = {
      jobId: 'testDocTextDetection',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };

    textractMock.on(StartDocumentTextDetectionCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);

    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const textractJob = new TextractBacklogJob();

    const response = await textractJob.startDocumentTextDetection(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });
});
