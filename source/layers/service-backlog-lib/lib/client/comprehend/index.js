// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('aws-sdk');
  }
})();
const {
  DataAccess,
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
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
      customUserAgent: CustomUserAgent,
    });
  }

  bindToFunc(serviceApi) {
    const comprehend = this.getComprehendInstance();
    switch (serviceApi) {
      case ComprehendBacklogJob.ServiceApis.StartDocumentClassificationJob:
        return comprehend.startDocumentClassificationJob.bind(comprehend);
      case ComprehendBacklogJob.ServiceApis.StartDominantLanguageDetectionJob:
        return comprehend.startDominantLanguageDetectionJob.bind(comprehend);
      case ComprehendBacklogJob.ServiceApis.StartEntitiesDetectionJob:
        return comprehend.startEntitiesDetectionJob.bind(comprehend);
      case ComprehendBacklogJob.ServiceApis.StartKeyPhrasesDetectionJob:
        return comprehend.startKeyPhrasesDetectionJob.bind(comprehend);
      case ComprehendBacklogJob.ServiceApis.StartSentimentDetectionJob:
        return comprehend.startSentimentDetectionJob.bind(comprehend);
      case ComprehendBacklogJob.ServiceApis.StartTopicsDetectionJob:
        return comprehend.startTopicsDetectionJob.bind(comprehend);
      default:
        return undefined;
    }
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
