// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  beforeAll,
  describe,
  expect,
} = require('@jest/globals');
const {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
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
const BacklogJob = require('./backlogJob');
const EBHelper = require('../shared/ebHelper');
const {
  M2CException,
} = require('../shared/error');

const ddbMock = mockClient(DynamoDBClient);
const eventbridgeMock = mockClient(EventBridgeClient);

const mockResponse = {
  jobId: 'jobId',
  Items: [
    {
      serviceApi: 'mockServiceApi',
      serviceParams: {
        jobId: 'job1',
      },
      id: 'item1',
    }, {
      serviceApi: 'mockServiceApi',
      serviceParams: {
        jobId: 'job2',
      },
      id: 'item2',
    },
  ],
  Attributes: {
    key: 'value',
  },
};

describe('Test BacklogJob', () => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Test createJobItem', async () => {
    const id = 'id';
    const serviceApi = 'mockservice:api';
    const serviceParams = {};
    const status = 'status';
    const jobId = 'jobId';

    ddbMock.on(PutItemCommand)
      .resolves({});

    const backlog = new BacklogJob();
    const response = await backlog.createJobItem(
      id,
      serviceApi,
      serviceParams,
      status,
      jobId
    );

    expect(response.id)
      .toBe(id);

    expect(response.serviceApi)
      .toBe(serviceApi);

    expect(response.jobId)
      .toBe(jobId);

    expect(response.status)
      .toBe(status);

    expect(response.timestamp)
      .toBeGreaterThan(0);

    expect(response.ttl)
      .toBeGreaterThan(0);
  });

  test('Test updateJobId', async () => {
    const jobId = 'jobId';

    const item = {
      id: 'id',
      serviceApi: 'mockservice:api',
    };

    const updateResponse = {
      Attributes: marshall(item),
    };

    ddbMock.on(UpdateItemCommand)
      .resolves(updateResponse);

    const backlog = new BacklogJob();
    const response = await backlog.updateJobId(
      item,
      jobId
    );

    expect(response.id)
      .toBe(item.id);

    expect(response.serviceApi)
      .toBe(item.serviceApi);
  });

  test('Test deleteJob', async () => {
    const item = {
      id: 'id',
      jobId: 'jobId',
      serviceApi: 'mockservice:api',
    };

    const queryResponse = {
      Items: [
        marshall(item),
      ],
    };
    ddbMock.on(QueryCommand)
      .resolves(queryResponse);

    const deleteResponse = {
      Attributes: marshall(item),
    };

    ddbMock.on(DeleteItemCommand)
      .resolves(deleteResponse);

    const backlog = new BacklogJob();
    const response = await backlog.deleteJob(
      item.jobId,
      'status',
      {}
    );

    expect(response.id)
      .toBe(item.id);

    expect(response.jobId)
      .toBe(item.jobId);

    expect(response.serviceApi)
      .toBe(item.serviceApi);
  });

  test('Test getJobById', async () => {
    const item = {
      id: 'id',
      jobId: 'jobId',
      serviceApi: 'mockservice:api',
    };

    const queryResponse = {
      Items: [
        marshall(item),
      ],
    };

    ddbMock.on(QueryCommand)
      .resolves(queryResponse);

    const backlog = new BacklogJob();
    const response = await backlog.getJobById(
      item.jobId
    );

    expect(response[0].id)
      .toBe(item.id);

    expect(response[0].jobId)
      .toBe(item.jobId);

    expect(response[0].serviceApi)
      .toBe(item.serviceApi);
  });

  test('Test getQueuedJobs with queued items', async () => {
    const prefix = 'mockservice';
    const prevJob = {};

    const queuedItems = [
      1, 2,
    ].map((jobId) => ({
      serviceApi: `${prefix}:api`,
      serviceParams: {
        jobId: `job${jobId}`,
      },
      id: `item${jobId}`,
    }));

    const queryResponse = {
      Items: queuedItems
        .map((item) =>
          marshall(item)),
    };

    ddbMock.on(QueryCommand)
      .resolves(queryResponse);

    const backlog = new BacklogJob();
    const response = await backlog.getQueuedJobs(
      prefix,
      prevJob
    );

    expect(response.length)
      .toBe(queryResponse.Items.length);
  });

  test('Test getQueuedJobs with no item', async () => {
    const prefix = 'mockservice';
    const prevJob = {};

    const queryResponse = {
      Items: [],
    };

    ddbMock.on(QueryCommand)
      .resolves(queryResponse);

    const backlog = new BacklogJob();
    const response = await backlog.getQueuedJobs(
      prefix,
      prevJob
    );

    expect(response.length)
      .toBe(0);
  });

  test('Test startAndRegisterJob should fail', async () => {
    const backlog = new BacklogJob();

    await backlog.startAndRegisterJob('id', 'serviceApi', {})
      .catch((error) => {
        expect(error.name)
          .toBe('M2CException');

        expect(error.message)
          .toBe('subclass to implement startJob');
      });
  });

  test('Test fetchAndStartJobs should fail', async () => {
    const item = {
      id: 'id',
      jobId: 'jobId',
      serviceApi: 'mockservice:api',
    };

    const queryResponse = {
      Items: [
        marshall(item),
      ],
    };
    ddbMock.on(QueryCommand)
      .resolves(queryResponse);

    const backlog = new BacklogJob();

    await backlog.fetchAndStartJobs('id', 'serviceApi', {})
      .catch((error) => {
        expect(error.name)
          .toBe('M2CException');

        expect(error.message)
          .toBe('subclass to implement startJob');
      });
  });
});

describe('Test EBHelper', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    eventbridgeMock.reset();
  });

  test('Test send succeeded', async () => {
    const message = 'testSendMessage';

    eventbridgeMock.on(PutEventsCommand)
      .resolves(message);

    const response = await EBHelper.send(message);

    expect(response)
      .toBe(message);
  });

  test('Test send failed', async () => {
    await EBHelper.send()
      .catch((error) => {
        expect(error.name)
          .toBe('M2CException');

        expect(error.message)
          .toBe('message not defined');
      });
  });
});
