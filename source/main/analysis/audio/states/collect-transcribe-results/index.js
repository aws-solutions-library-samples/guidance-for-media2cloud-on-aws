// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
  Environment,
} = require('core-lib');

const CATEGORY = 'transcribe';
const JOB_COMPLETED = 'COMPLETED';

class StateTranscribeResults {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateTranscribeResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    try {
      /* get job result */
      const jobId = this.stateData.data[CATEGORY].jobId;
      const jobResult = await this.getJob(jobId);
      if (jobResult.TranscriptionJob.TranscriptionJobStatus !== JOB_COMPLETED) {
        const message = jobResult.TranscriptionJob.FailureReason
          || jobResult.TranscriptionJob.TranscriptionJobStatus;
        throw new Error(`${jobId}: ${message};`);
      }
      /* download transcription */
      const bucket = this.stateData.input.destination.bucket;
      const output = PATH.join(this.stateData.data[CATEGORY].output, `${jobId}.json`);
      await CommonUtils.headObject(bucket, output);
      const vtt = PATH.join(this.stateData.data[CATEGORY].output, `${jobId}.vtt`);
      await CommonUtils.headObject(bucket, vtt);
      return this.setCompleted({
        languageCode: jobResult.TranscriptionJob.LanguageCode,
        output,
        vtt,
      });
    } catch (e) {
      return this.setNoData(e.message);
    }
  }

  async getJob(jobId) {
    const transcribe = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    return transcribe.getTranscriptionJob({
      TranscriptionJobName: jobId,
    }).promise();
  }

  setNoData(message) {
    this.stateData.setData(CATEGORY, {
      errorMessage: message,
      endTime: new Date().getTime(),
    });
    this.stateData.setNoData();
    return this.stateData.toJSON();
  }

  setCompleted(data) {
    this.stateData.setData(CATEGORY, {
      ...data,
      endTime: new Date().getTime(),
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateTranscribeResults;
