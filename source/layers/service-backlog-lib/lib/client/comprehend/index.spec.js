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
const ComprehendBacklogJob = require('./index.js');
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


describe('Test ComprehendBacklogJob', () => {
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

  test('Test startDocumentClassificationJob', async () => {
    const comprehendJob = new ComprehendBacklogJob();
    const params = {
      jobId: 'testDocClassification'
    };

    const response = await comprehendJob.startDocumentClassificationJob('id', params);
    expect(response.serviceApi).toBe(ComprehendBacklogJob.ServiceApis.StartDocumentClassificationJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startDominantLanguageDetectionJob', async () => {
    const comprehendJob = new ComprehendBacklogJob();
    const params = {
      jobId: 'testDominantLang'
    };

    const response = await comprehendJob.startDominantLanguageDetectionJob('id', params);
    expect(response.serviceApi).toBe(ComprehendBacklogJob.ServiceApis.StartDominantLanguageDetectionJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startEntitiesDetectionJob', async () => {
    const comprehendJob = new ComprehendBacklogJob();
    const params = {
      jobId: 'testEntitiesDetect'
    };

    const response = await comprehendJob.startEntitiesDetectionJob('id', params);
    expect(response.serviceApi).toBe(ComprehendBacklogJob.ServiceApis.StartEntitiesDetectionJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startKeyPhrasesDetectionJob', async () => {
    const comprehendJob = new ComprehendBacklogJob();
    const params = {
      jobId: 'testKeyPhrase'
    };

    const response = await comprehendJob.startKeyPhrasesDetectionJob('id', params);
    expect(response.serviceApi).toBe(ComprehendBacklogJob.ServiceApis.StartKeyPhrasesDetectionJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startSentimentDetectionJob', async () => {
    const comprehendJob = new ComprehendBacklogJob();
    const params = {
      jobId: 'testSentimentDetect'
    };

    const response = await comprehendJob.startSentimentDetectionJob('id', params);
    expect(response.serviceApi).toBe(ComprehendBacklogJob.ServiceApis.StartSentimentDetectionJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startTopicsDetectionJob', async () => {
    const comprehendJob = new ComprehendBacklogJob();
    const params = {
      jobId: 'testTopicDetect'
    };

    const response = await comprehendJob.startTopicsDetectionJob('id', params);
    expect(response.serviceApi).toBe(ComprehendBacklogJob.ServiceApis.StartTopicsDetectionJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });
});