/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/
const CustomBacklogJob = require('./index.js');
const Retry = require('../../shared/retry');
const AWS = require('aws-sdk-mock');
const SDK = require('aws-sdk');
AWS.setSDKInstance(SDK);

const mockItems = [
  {
    serviceApi: CustomBacklogJob.ServiceApis.StartCustomLabelsDetection,
    serviceParams: {
      jobId: 'jobid'
    },
    id: 'itemId'
  }
];
const mockResponseItems = jest.fn((fn, params) => {
  const response = {
    jobId: params.jobId,
    Items: mockItems
  };
  return Promise.resolve(response);
});
const mockResponseNoItems = jest.fn((fn, params) => {
  const response = {
    jobId: params.jobId,
    Items: []
  };
  return Promise.resolve(response);
});
const mockUpdateDeleteItem = jest.fn((fn, params) => {
  return Promise.resolve(params);
});
const mockUpdateItemReject = jest.fn((fn, params) => {
  return Promise.reject({ code: 'ConditionalCheckFailedException' });
});

jest.mock('../../shared/retry', () => {
  return {
    run: null
  };
});


describe('Test CustomBacklogJob', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('DynamoDB.Converter', 'unmarshall', Promise.resolve({ serviceApi: 'test' }));
  });

  afterEach(() => {
    AWS.restore('DynamoDB.Converter');
    jest.clearAllMocks();
  });

  test('Test startCustomLabelsDetection', async () => {
    const customJob = new CustomBacklogJob();
    const params = {
      jobId: 'testCustomLabels',
      input: {
        projectVersionArn: 'arn'
      }
    };

    Retry.run = mockResponseItems;
    const response = await customJob.startCustomLabelsDetection('id', params);
    expect(response.serviceApi).toBe(CustomBacklogJob.ServiceApis.StartCustomLabelsDetection);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test fetchAndStartJobs', async () => {
    const customJob = new CustomBacklogJob();
    const prev = {
      serviceParams: {
        input: {
          projectVersionArn: 'arn'
        }
      }
    };

    Retry.run = mockResponseItems;
    let response = await customJob.fetchAndStartJobs(CustomBacklogJob.ServiceApis.StartCustomLabelsDetection, prev);
    expect(response.notStarted[0]).toBe(mockItems[0]['id']);
    expect(response.total).toBe(mockItems.length);

    Retry.run = mockResponseNoItems;
    response = await customJob.fetchAndStartJobs(CustomBacklogJob.ServiceApis.StartCustomLabelsDetection, prev);
    expect(response.total).toBe(0);
  });

  test('Test AtomicLockTable functions', async () => {
    const customJob = new CustomBacklogJob();
    const item = {
      serviceParams: {
        input: {
          projectVersionArn: 'beforeDeleteJob'
        }
      }
    };

    Retry.run = mockUpdateDeleteItem;
    let response = await customJob.beforeDeleteJob(item, '');
    expect(response.serviceParams.input.projectVersionArn).toBe(item.serviceParams.input.projectVersionArn);

    expect(await CustomBacklogJob.updateTTL('updateTTL', 10)).toBe(true);

    Retry.run = mockUpdateItemReject;
    expect(await CustomBacklogJob.updateTTL('updateTTL', 10)).toBe(false);
  });
});