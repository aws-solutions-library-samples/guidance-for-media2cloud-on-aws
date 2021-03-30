// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const {
  DataAccess,
} = require('../../shared/defs');

const BacklogJob = require('../backlogJob');

class TranscribeBacklogJob extends BacklogJob {
  static get ServiceApis() {
    return {
      StartMedicalTranscriptionJob: 'transcribe:startMedicalTranscriptionJob',
      StartTranscriptionJob: 'transcribe:startTranscriptionJob',
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

  getTranscribeInstance() {
    return new AWS.TranscribeService({
      apiVersion: '2017-10-26',
    });
  }

  bindToFunc(serviceApi) {
    const transcribe = this.getTranscribeInstance();
    return (serviceApi === TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob)
      ? transcribe.startMedicalTranscriptionJob.bind(transcribe)
      : (serviceApi === TranscribeBacklogJob.ServiceApis.StartTranscriptionJob)
        ? transcribe.startTranscriptionJob.bind(transcribe)
        : undefined;
  }

  async startAndRegisterJob(id, serviceApi, params) {
    const serviceParams = {
      ...params,
    };
    if (serviceApi === TranscribeBacklogJob.ServiceApis.StartTranscriptionJob) {
      serviceParams.TranscriptionJobName = id;
    } else if (serviceApi === TranscribeBacklogJob.ServiceApis.StartTranscriptionJob) {
      serviceParams.MedicalTranscriptionJobName = id;
    }
    if ((serviceParams.JobExecutionSettings || {}).DataAccessRoleArn) {
      serviceParams.JobExecutionSettings.DataAccessRoleArn = DataAccess.RoleArn;
    }
    return super.startAndRegisterJob(id, serviceApi, serviceParams);
  }

  async startJob(serviceApi, serviceParams) {
    let response = await super.startJob(serviceApi, serviceParams)
      .catch(e => e);
    if (response instanceof Error) {
      response = await this.testJob(serviceApi, serviceParams, response);
    }
    return {
      JobId: (response.TranscriptionJob)
        ? response.TranscriptionJob.TranscriptionJobName
        : response.MedicalTranscriptionJob.MedicalTranscriptionJobName,
    };
  }

  async testJob(serviceApi, serviceParams, originalError) {
    /**
     * Transcribe doesn't use ClientRequestToken. Test ConflictException
     * and try to get the actual TranscriptionJobName (JobId)
     */
    let response;
    if (!this.conflictException(originalError.code)) {
      throw originalError;
    }
    const transcribe = this.getTranscribeInstance();
    if (serviceApi === TranscribeBacklogJob.ServiceApis.StartMedicalTranscriptionJob) {
      response = await transcribe.getMedicalTranscriptionJob({
        MedicalTranscriptionJobName: serviceParams.MedicalTranscriptionJobName,
      }).promise();
    } else if (serviceApi === TranscribeBacklogJob.ServiceApis.StartTranscriptionJob) {
      response = await transcribe.getTranscriptionJob({
        TranscriptionJobName: serviceParams.TranscriptionJobName,
      }).promise();
    }
    /**
     * if job is already completed,
     * throw the original error so we don't queue the process
     */
    const status = (response.TranscriptionJob || {}).TranscriptionJobStatus
      || (response.MedicalTranscriptionJob || {}).TranscriptionJobStatus;
    if (status === 'FAILED' || status === 'COMPLETED') {
      throw originalError;
    }
    return response;
  }

  noMoreQuotasException(code) {
    return (code === 'LimitExceededException');
  }

  conflictException(code) {
    return (code === 'ConflictException');
  }
}

module.exports = TranscribeBacklogJob;
