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
const BacklogJob = require('../backlogJob');
const {
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('../../shared/defs');

class TextractBacklogJob extends BacklogJob {
  static get ServiceApis() {
    return {
      StartDocumentAnalysis: 'textract:startdocumentanalysis',
      StartDocumentTextDetection: 'textract:startdocumenttextdetection',
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
      customUserAgent: CustomUserAgent,
    });
  }

  bindToFunc(serviceApi) {
    const textract = this.getTextractInstance();
    switch (serviceApi) {
      case TextractBacklogJob.ServiceApis.StartDocumentAnalysis:
        return textract.startDocumentAnalysis.bind(textract);
      case TextractBacklogJob.ServiceApis.StartDocumentTextDetection:
        return textract.startDocumentTextDetection.bind(textract);
      default:
        return undefined;
    }
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
    const errors = [
      'LimitExceededException',
      'ProvisionedThroughputExceededException',
      'ThrottlingException',
    ];
    return errors.includes(code);
  }
}

module.exports = TextractBacklogJob;
