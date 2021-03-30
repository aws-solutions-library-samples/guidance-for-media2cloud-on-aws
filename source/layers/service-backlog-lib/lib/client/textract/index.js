// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const BacklogJob = require('../backlogJob');

class TextractBacklogJob extends BacklogJob {
  static get ServiceApis() {
    return {
      StartDocumentAnalysis: 'textract:startDocumentAnalysis',
      StartDocumentTextDetection: 'textract:startDocumentTextDetection',
    };
  }

  async startDocumentAnalysis(id, params) {
    return this.startAndRegisterJob(
      id,
      TextractBacklogJob.ServiceApis.StartDocumentAnalysis,
      params
    );
  }

  async startDocumentTextDetection(id, params) {
    return this.startAndRegisterJob(
      id,
      TextractBacklogJob.ServiceApis.StartDocumentTextDetection,
      params
    );
  }

  static isService(serviceApi) {
    return Object.values(TextractBacklogJob.ServiceApis).indexOf(serviceApi) >= 0;
  }

  getTextractInstance() {
    return new AWS.Textract({
      apiVersion: '2018-06-27',
    });
  }

  bindToFunc(serviceApi) {
    const textract = this.getTextractInstance();
    return (serviceApi === TextractBacklogJob.ServiceApis.StartDocumentAnalysis)
      ? textract.startDocumentAnalysis.bind(textract)
      : (serviceApi === TextractBacklogJob.ServiceApis.StartDocumentTextDetection)
        ? textract.startDocumentTextDetection.bind(textract)
        : undefined;
  }

  async startAndRegisterJob(id, serviceApi, params) {
    const serviceParams = {
      ...params,
      ClientRequestToken: id,
      NotificationChannel: this.getServiceTopic(),
    };
    return super.startAndRegisterJob(id, serviceApi, serviceParams);
  }

  // ddb stream
  async fetchAndStartJobs(serviceApi, previousJob) {
    return super.fetchAndStartJobs('textract', previousJob);
  }

  noMoreQuotasException(code) {
    return (code === 'LimitExceededException');
  }
}

module.exports = TextractBacklogJob;
