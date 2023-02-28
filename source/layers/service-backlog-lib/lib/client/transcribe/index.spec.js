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
const TranscribeBacklogJob = require('./index.js');
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


describe('Test TranscribeBacklogJob', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('DynamoDB.Converter', 'unmarshall', Promise.resolve({ serviceApi: 'test' }));
    AWS.mock('TranscribeService', 'getTranscriptionJob', Promise.resolve({
      TranscriptionJob: {
        TranscriptionJobStatus: 'COMPLETED'
      }
    }));
    AWS.mock('TranscribeService', 'getMedicalTranscriptionJob', Promise.resolve({
      MedicalTranscriptionJob: {
        TranscriptionJobStatus: 'COMPLETED'
      }
    }));
  });

  afterEach(() => {
    AWS.restore('DynamoDB.Converter');
    AWS.restore('TranscribeService');
  });

  test('Test startMedicalTranscriptionJob', async () => {
    const transcribeJob = new TranscribeBacklogJob();
    const params = {
      jobId: 'testMedicalTranscription'
    };

    const response = await transcribeJob.startMedicalTranscriptionJob('id', params);
    expect(response.serviceApi).toBe(TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test startTranscriptionJob', async () => {
    const transcribeJob = new TranscribeBacklogJob();
    const params = {
      jobId: 'testTranscription'
    };

    const response = await transcribeJob.startTranscriptionJob('id', params);
    expect(response.serviceApi).toBe(TranscribeBacklogJob.ServiceApis.StartTranscriptionJob);
    expect(response.serviceParams.jobId).toBe(params.jobId);
  });

  test('Test testJob', async () => {
    const transcribeJob = new TranscribeBacklogJob();
    const params = {
      jobId: 'testTranscription',
      TranscriptionJobName: 'jobName',
      MedicalTranscriptionJobName: 'jobName'
    };

    await transcribeJob.testJob(TranscribeBacklogJob.ServiceApis.StartTranscriptionJob, params, { code: 'ConflictException' }).catch(error => {
      expect(error['code']).toBe('ConflictException');
    });

    await transcribeJob.testJob(TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob, params, { code: 'ConflictException' }).catch(error => {
      expect(error['code']).toBe('ConflictException');
    });
  });
});