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
const RekognitionBacklogJob = require('./index.js');
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


describe('Test RekognitionBacklogJob', () => {
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

  test('Test startCelebrityRecognition', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testCelebRekog'
    };

    const response = await rekognitionJob.startCelebrityRecognition('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartCelebrityRecognition);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startContentModeration', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testContentMod'
    };

    const response = await rekognitionJob.startContentModeration('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartContentModeration);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startFaceDetection', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testFaceDetect'
    };

    const response = await rekognitionJob.startFaceDetection('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartFaceDetection);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startFaceSearch', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testFaceSearch'
    };

    const response = await rekognitionJob.startFaceSearch('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartFaceSearch);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startLabelDetection', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testLabelDetect'
    };

    const response = await rekognitionJob.startLabelDetection('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartLabelDetection);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startPersonTracking', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testPersonTrack'
    };

    const response = await rekognitionJob.startPersonTracking('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartPersonTracking);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startSegmentDetection', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testSegmentDetect'
    };

    const response = await rekognitionJob.startSegmentDetection('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartSegmentDetection);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startTextDetection', async () => {
    const rekognitionJob = new RekognitionBacklogJob();
    const params = {
      jobId: 'testTextDetect'
    };

    const response = await rekognitionJob.startTextDetection('id', params);
    expect(response.serviceApi).toBe(RekognitionBacklogJob.ServiceApis.StartTextDetection);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });
});