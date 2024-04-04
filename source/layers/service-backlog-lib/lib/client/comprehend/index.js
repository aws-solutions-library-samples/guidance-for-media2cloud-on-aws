// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  ComprehendClient,
  StartDocumentClassificationJobCommand,
  StartDominantLanguageDetectionJobCommand,
  StartEntitiesDetectionJobCommand,
  StartKeyPhrasesDetectionJobCommand,
  StartSentimentDetectionJobCommand,
  StartTopicsDetectionJobCommand,
} = require('@aws-sdk/client-comprehend');
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

class ComprehendBacklogJob extends BacklogJob {
  static get ServiceApis() {
    return {
      StartDocumentClassificationJob: 'comprehend:startdocumentclassificationjob',
      StartDominantLanguageDetectionJob: 'comprehend:startdominantlanguagedetectionjob',
      StartEntitiesDetectionJob: 'comprehend:startentitiesdetectionjob',
      StartKeyPhrasesDetectionJob: 'comprehend:startkeyphrasesdetectionjob',
      StartSentimentDetectionJob: 'comprehend:startsentimentdetectionjob',
      StartTopicsDetectionJob: 'comprehend:starttopicsdetectionjob',
    };
  }

  async startDocumentClassificationJob(id, params) {
    return this.startAndRegisterJob(
      id,
      ComprehendBacklogJob.ServiceApis.StartDocumentClassificationJob,
      params
    );
  }

  async startDominantLanguageDetectionJob(id, params) {
    return this.startAndRegisterJob(
      id,
      ComprehendBacklogJob.ServiceApis.StartDominantLanguageDetectionJob,
      params
    );
  }

  async startEntitiesDetectionJob(id, params) {
    return this.startAndRegisterJob(
      id,
      ComprehendBacklogJob.ServiceApis.StartEntitiesDetectionJob,
      params
    );
  }

  async startKeyPhrasesDetectionJob(id, params) {
    return this.startAndRegisterJob(
      id,
      ComprehendBacklogJob.ServiceApis.StartKeyPhrasesDetectionJob,
      params
    );
  }

  async startSentimentDetectionJob(id, params) {
    return this.startAndRegisterJob(
      id,
      ComprehendBacklogJob.ServiceApis.StartSentimentDetectionJob,
      params
    );
  }

  async startTopicsDetectionJob(id, params) {
    return this.startAndRegisterJob(
      id,
      ComprehendBacklogJob.ServiceApis.StartTopicsDetectionJob,
      params
    );
  }

  static isService(serviceApi) {
    return Object.values(ComprehendBacklogJob.ServiceApis).indexOf(serviceApi) >= 0;
  }

  async startJob(serviceApi, serviceParams) {
    let command;
    if (serviceApi === ComprehendBacklogJob.ServiceApis.StartDocumentClassificationJob) {
      command = new StartDocumentClassificationJobCommand(serviceParams);
    } else if (serviceApi === ComprehendBacklogJob.ServiceApis.StartDominantLanguageDetectionJob) {
      command = new StartDominantLanguageDetectionJobCommand(serviceParams);
    } else if (serviceApi === ComprehendBacklogJob.ServiceApis.StartEntitiesDetectionJob) {
      command = new StartEntitiesDetectionJobCommand(serviceParams);
    } else if (serviceApi === ComprehendBacklogJob.ServiceApis.StartKeyPhrasesDetectionJob) {
      command = new StartKeyPhrasesDetectionJobCommand(serviceParams);
    } else if (serviceApi === ComprehendBacklogJob.ServiceApis.StartSentimentDetectionJob) {
      command = new StartSentimentDetectionJobCommand(serviceParams);
    } else if (serviceApi === ComprehendBacklogJob.ServiceApis.StartTopicsDetectionJob) {
      command = new StartTopicsDetectionJobCommand(serviceParams);
    } else {
      console.error(
        'ERR:',
        'ComprehendBacklogJob.startJob:',
        'not supported',
        serviceApi
      );
      throw new M2CException(`${serviceApi} not supported`);
    }

    const comprehendClient = xraysdkHelper(new ComprehendClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    return comprehendClient.send(command);
  }

  async startAndRegisterJob(id, serviceApi, params) {
    const serviceParams = {
      ...params,
      DataAccessRoleArn: DataAccess.RoleArn,
      ClientRequestToken: id,
      JobName: id,
    };
    return super.startAndRegisterJob(id, serviceApi, serviceParams);
  }

  // ddb stream
  async fetchAndStartJobs(serviceApi, previousJob) {
    return super.fetchAndStartJobs(serviceApi, previousJob);
  }

  noMoreQuotasException(name) {
    return (name === 'TooManyRequestsException');
  }
}

module.exports = ComprehendBacklogJob;
