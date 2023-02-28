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
const TextractBacklogJob = require('./index.js');
const AWS = require('aws-sdk-mock');
const SDK = require('aws-sdk');
AWS.setSDKInstance(SDK);

jest.mock('../../shared/retry', () => {
  return {
    run: jest.fn((fn, params) => {
      return Promise.resolve({ jobId: params.jobId });
    })
  };
});


describe('Test TextractBacklogJob', () => {
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

  test('Test startDocumentAnalysis', async () => {
    const textractJob = new TextractBacklogJob();
    const params = {
      jobId: 'testDocAnalysis'
    };

    const response = await textractJob.startDocumentAnalysis('id', params);
    expect(response.serviceApi).toBe(TextractBacklogJob.ServiceApis.StartDocumentAnalysis);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startDocumentTextDetection', async () => {
    const textractJob = new TextractBacklogJob();
    const params = {
      jobId: 'testDocTextDetect'
    };

    const response = await textractJob.startDocumentTextDetection('id', params);
    expect(response.serviceApi).toBe(TextractBacklogJob.ServiceApis.StartDocumentTextDetection);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });
});