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
  TranscribeClient,
  GetTranscriptionJobCommand,
  StartMedicalTranscriptionJobCommand,
  StartTranscriptionJobCommand,
} = require('@aws-sdk/client-transcribe');
const {
  EventBridgeClient,
  PutEventsCommand,
} = require('@aws-sdk/client-eventbridge');
const {
  mockClient,
} = require('aws-sdk-client-mock');

const TranscribeBacklogJob = require('./index');

const ddbMock = mockClient(DynamoDBClient);
const transcribeMock = mockClient(TranscribeClient);
const eventbridgeMock = mockClient(EventBridgeClient);

describe('Test TranscribeBacklogJob', () => {
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
    transcribeMock.reset();
  });

  afterEach(() => {
  });

  test('Test startMedicalTranscriptionJob', async () => {
    const serviceApi = TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob;
    const serviceParams = {
      jobId: 'testMedicalTranscription',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    transcribeMock.on(StartMedicalTranscriptionJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const transcribeJob = new TranscribeBacklogJob();

    const response = await transcribeJob.startMedicalTranscriptionJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test startTranscriptionJob', async () => {
    const serviceApi = TranscribeBacklogJob.ServiceApis.StartTranscriptionJob;
    const serviceParams = {
      jobId: 'testTranscription',
    };

    const startJobResponse = {
      serviceApi,
      serviceParams,
    };
    transcribeMock.on(StartTranscriptionJobCommand)
      .resolves(startJobResponse);

    const tableResponse = marshall(startJobResponse);
    ddbMock.on(PutItemCommand)
      .resolves(tableResponse);

    const transcribeJob = new TranscribeBacklogJob();

    const response = await transcribeJob.startTranscriptionJob(
      'id',
      serviceParams
    );

    expect(response.serviceApi)
      .toBe(TranscribeBacklogJob.ServiceApis.StartTranscriptionJob);

    expect(response.serviceParams.jobId)
      .toBe(serviceParams.jobId);
  });

  test('Test testJob (duplicated request already in progress)', async () => {
    const serviceApi = TranscribeBacklogJob.ServiceApis.StartTranscriptionJob;
    const serviceParams = {
      jobId: 'testTranscription',
      TranscriptionJobName: 'jobName',
    };
    const mockException = {
      name: 'ConflictException',
    };

    const getJobResponse = {
      TranscriptionJob: {
        ...serviceParams,
        TranscriptionJobStatus: 'QUEUED',
      },
    };

    transcribeMock.on(GetTranscriptionJobCommand)
      .resolves(getJobResponse);

    const transcribeJob = new TranscribeBacklogJob();
    const response = await transcribeJob.testJob(
      serviceApi,
      serviceParams,
      mockException
    );

    expect(response.TranscriptionJob.TranscriptionJobStatus)
      .toBe('QUEUED');

    expect(response.TranscriptionJob.TranscriptionJobName)
      .toBe(serviceParams.TranscriptionJobName);
  });

  test('Test testJob (duplicated request with invalid status)', async () => {
    const serviceApi = TranscribeBacklogJob.ServiceApis.StartTranscriptionJob;
    const serviceParams = {
      jobId: 'testTranscription',
      TranscriptionJobName: 'jobName',
    };
    const mockException = {
      name: 'ConflictException',
    };

    const getJobResponse = {
      TranscriptionJob: {
        ...serviceParams,
        TranscriptionJobStatus: 'COMPLETED',
      },
    };

    transcribeMock.on(GetTranscriptionJobCommand)
      .resolves(getJobResponse);

    const transcribeJob = new TranscribeBacklogJob();
    await transcribeJob.testJob(
      serviceApi,
      serviceParams,
      mockException
    ).catch((error) => {
      expect(error.name)
        .toBe(mockException.name);
    });
  });

  test('Test testJob (other exceptions)', async () => {
    const serviceApi = TranscribeBacklogJob.ServiceApis.StartTranscriptionJob;
    const serviceParams = {
      jobId: 'testTranscription',
      TranscriptionJobName: 'jobName',
    };
    const mockException = {
      name: 'OtherException',
    };

    const transcribeJob = new TranscribeBacklogJob();
    await transcribeJob.testJob(
      serviceApi,
      serviceParams,
      mockException
    ).catch((error) => {
      expect(error.name)
        .toBe(mockException.name);
    });
  });
});
