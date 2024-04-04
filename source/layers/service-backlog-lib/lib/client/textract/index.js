// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  TextractClient,
  StartDocumentAnalysisCommand,
  StartDocumentTextDetectionCommand,
} = require('@aws-sdk/client-textract');
const {
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

  async startJob(serviceApi, serviceParams) {
    let command;
    if (serviceApi === TextractBacklogJob.ServiceApis.StartDocumentAnalysis) {
      command = new StartDocumentAnalysisCommand(serviceParams);
    } else if (serviceApi === TextractBacklogJob.ServiceApis.StartDocumentTextDetection) {
      command = new StartDocumentTextDetectionCommand(serviceParams);
    } else {
      console.error(
        'ERR:',
        'TextractBacklogJob.startJob:',
        'not supported:',
        serviceApi
      );
      throw new M2CException(`${serviceApi} not supported`);
    }

    const textractClient = xraysdkHelper(new TextractClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    return textractClient.send(command);
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

  noMoreQuotasException(name) {
    const errors = [
      'LimitExceededException',
      'ProvisionedThroughputExceededException',
      'ThrottlingException',
    ];
    return errors.includes(name);
  }
}

module.exports = TextractBacklogJob;
