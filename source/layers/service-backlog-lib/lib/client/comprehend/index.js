// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const {
  DataAccess,
} = require('../../shared/defs');
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

  getComprehendInstance() {
    return new AWS.Comprehend({
      apiVersion: '2017-11-27',
    });
  }

  bindToFunc(serviceApi) {
    const comprehend = this.getComprehendInstance();
    return (serviceApi === ComprehendBacklogJob.ServiceApis.StartDocumentClassificationJob)
      ? comprehend.startDocumentClassificationJob.bind(comprehend)
      : (serviceApi === ComprehendBacklogJob.ServiceApis.StartDominantLanguageDetectionJob)
        ? comprehend.startDominantLanguageDetectionJob.bind(comprehend)
        : (serviceApi === ComprehendBacklogJob.ServiceApis.StartEntitiesDetectionJob)
          ? comprehend.startEntitiesDetectionJob.bind(comprehend)
          : (serviceApi === ComprehendBacklogJob.ServiceApis.StartKeyPhrasesDetectionJob)
            ? comprehend.startKeyPhrasesDetectionJob.bind(comprehend)
            : (serviceApi === ComprehendBacklogJob.ServiceApis.StartSentimentDetectionJob)
              ? comprehend.startSentimentDetectionJob.bind(comprehend)
              : (serviceApi === ComprehendBacklogJob.ServiceApis.StartTopicsDetectionJob)
                ? comprehend.startTopicsDetectionJob.bind(comprehend)
                : undefined;
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

  noMoreQuotasException(code) {
    return (code === 'TooManyRequestsException');
  }
}

module.exports = ComprehendBacklogJob;
