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
const BacklogJob = require('./backlogJob');
const EBHelper = require('../shared/ebHelper');

const mockResponse = {
  jobId: 'jobId',
  Items: [
    {
      serviceApi: 'mockServiceApi',
      serviceParams: {
        jobId: 'job1'
      },
      id: 'item1'
    }, {
      serviceApi: 'mockServiceApi',
      serviceParams: {
        jobId: 'job2'
      },
      id: 'item2'
    }
  ],
  Attributes: {
    key: 'value'
  }
};

jest.mock('../shared/retry', () => {
  return {
    run: jest.fn((fn, params) => {
      return Promise.resolve(mockResponse);
    })
  };
});


describe('Test BacklogJob', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Test fetchAndStartJobs', async () => {
    const backlog = new BacklogJob();
    const prev = {
      serviceParams: {
        input: {
          projectVersionArn: 'arn'
        }
      }
    };

    let response = await backlog.fetchAndStartJobs('serviceapi', prev);
    expect(response.total).toBe(mockResponse.Items.length);

    backlog.bindToFunc = jest.fn().mockReturnValue(1); //override error
    response = await backlog.fetchAndStartJobs('serviceapi', prev);
    expect(response.total).toBe(mockResponse.Items.length);
  });

  test('Test deleteJob', async () => {
    const backlog = new BacklogJob();
    const status = 'deleteJobStatus';
    const output = { jobOutput: 'deleteJobOutput' };

    let response = await backlog.deleteJob('id', status, output);
    expect(response.status).toBe(status);
    expect(response).toEqual(expect.objectContaining(output));
    expect(response).toEqual(expect.objectContaining(mockResponse.Attributes));
  });

  test('Test startAndRegisterJob failure', async () => {
    const backlog = new BacklogJob();

    await backlog.startAndRegisterJob('id', 'serviceApi', {}).catch(error => {
      expect(error.message).toBe('subclass to implement bindToFunc');
    });
  });
});

describe('Test EBHelper', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  });

  test('Test send failure', async () => {
    await EBHelper.send().catch(error => {
      expect(error.message).toBe('message not defined');
    });
  });
});