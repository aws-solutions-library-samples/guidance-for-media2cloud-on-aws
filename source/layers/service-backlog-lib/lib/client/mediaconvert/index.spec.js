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
const MediaConvertBacklogJob = require('./index.js');
const AWS = require('aws-sdk-mock');
const SDK = require('aws-sdk');
AWS.setSDKInstance(SDK);

jest.mock('../../shared/retry', () => {
  return {
    run: jest.fn((fn, params) => {
      return Promise.resolve({
        Job: {
          Id: params.jobId
        }
      });
    })
  };
});


describe('Test MediaConvertBacklogJob', () => {
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
  });

  test('Test createJob', async () => {
    const mediaConvertJob = new MediaConvertBacklogJob();
    const params = {
      jobId: 'testCreateJob'
    };

    const response = await mediaConvertJob.createJob('id', params);
    expect(response.serviceApi).toBe(MediaConvertBacklogJob.ServiceApis.CreateJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });
});