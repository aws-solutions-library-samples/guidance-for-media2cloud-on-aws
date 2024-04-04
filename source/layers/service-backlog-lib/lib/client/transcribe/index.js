// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  TranscribeClient,
  GetMedicalTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  StartMedicalTranscriptionJobCommand,
  StartTranscriptionJobCommand,
} = require('@aws-sdk/client-transcribe');
const {
  DataAccess,
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('../../shared/defs');
const xraysdkHelper = require('../../shared/xraysdkHelper');
const retryStrategyHelper = require('../../shared/retryStrategyHelper');
const {
  M2CException,
} = require('../../shared/error');
const BacklogJob = require('../backlogJob');

class TranscribeBacklogJob extends BacklogJob {
  static get ServiceApis() {
    return {
      StartMedicalTranscriptionJob: 'transcribe:startmedicaltranscriptionjob',
      StartTranscriptionJob: 'transcribe:starttranscriptionjob',
    };
  }

  async startMedicalTranscriptionJob(id, params) {
    return this.startAndRegisterJob(
      id,
      TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob,
      params
    );
  }

  async startTranscriptionJob(id, params) {
    return this.startAndRegisterJob(
      id,
      TranscribeBacklogJob.ServiceApis.StartTranscriptionJob,
      params
    );
  }

  static isService(serviceApi) {
    return Object.values(TranscribeBacklogJob.ServiceApis).indexOf(serviceApi) >= 0;
  }

  async startAndRegisterJob(id, serviceApi, params) {
    const serviceParams = {
      ...params,
    };
    if (serviceApi === TranscribeBacklogJob.ServiceApis.StartTranscriptionJob) {
      serviceParams.TranscriptionJobName = id;
    } else if (serviceApi === TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob) {
      serviceParams.MedicalTranscriptionJobName = id;
    }
    if ((serviceParams.JobExecutionSettings || {}).DataAccessRoleArn) {
      serviceParams.JobExecutionSettings.DataAccessRoleArn = DataAccess.RoleArn;
    }
    return super.startAndRegisterJob(id, serviceApi, serviceParams);
  }

  async startJob(serviceApi, serviceParams) {
    let command;
    if (serviceApi === TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob) {
      command = new StartMedicalTranscriptionJobCommand(serviceParams);
    } else if (serviceApi === TranscribeBacklogJob.ServiceApis.StartTranscriptionJob) {
      command = new StartTranscriptionJobCommand(serviceParams);
    } else {
      console.error(
        'ERR:',
        'TranscribeBacklogJob.startJob:',
        'not supported:',
        serviceApi
      );
      throw new M2CException(`${serviceApi} not supported`);
    }

    const transcribeClient = xraysdkHelper(new TranscribeClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    let response = await transcribeClient.send(command)
      .catch((e) =>
        e);
    if (response instanceof Error) {
      response = await this.testJob(serviceApi, serviceParams, response);
    }

    return response;
  }

  async testJob(serviceApi, serviceParams, originalError) {
    /**
     * Transcribe doesn't use ClientRequestToken. Test ConflictException
     * and try to get the actual TranscriptionJobName (JobId)
     */
    if (!this.conflictException(originalError.name)) {
      throw originalError;
    }

    let command;
    if (serviceApi === TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob) {
      command = new GetMedicalTranscriptionJobCommand({
        MedicalTranscriptionJobName: serviceParams.MedicalTranscriptionJobName,
      });
    } else if (serviceApi === TranscribeBacklogJob.ServiceApis.StartTranscriptionJob) {
      command = new GetTranscriptionJobCommand({
        TranscriptionJobName: serviceParams.TranscriptionJobName,
      });
    } else {
      console.error(
        'ERR:',
        'TranscribeBacklogJob.testJob:',
        'not supported:',
        serviceApi
      );
      throw new M2CException(`${serviceApi} not supported`);
    }

    const transcribeClient = xraysdkHelper(new TranscribeClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    /**
     * if job is already completed,
     * throw the original error so we don't queue the process
     */
    const response = await transcribeClient.send(command);

    const status = (response.TranscriptionJob || {}).TranscriptionJobStatus
      || (response.MedicalTranscriptionJob || {}).TranscriptionJobStatus;
    if (status === 'FAILED' || status === 'COMPLETED') {
      throw originalError;
    }

    return response;
  }

  noMoreQuotasException(name) {
    return (name === 'LimitExceededException');
  }

  conflictException(name) {
    return (name === 'ConflictException');
  }

  parseJobId(data) {
    return (data.TranscriptionJob || {}).TranscriptionJobName
      || (data.MedicalTranscriptionJob || {}).MedicalTranscriptionJobName;
  }
}

module.exports = TranscribeBacklogJob;
