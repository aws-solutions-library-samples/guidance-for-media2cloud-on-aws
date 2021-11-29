// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  AnalysisTypes,
  Environment,
} = require('core-lib');
const {
  BacklogJob,
} = require('service-backlog-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const CATEGORY = 'comprehend';
const SUB_CATEGORY = AnalysisTypes.Comprehend.CustomEntity;
/* comprehend Job Status */
const SUBMITTED = 'SUBMITTED';
const IN_PROGRESS = 'IN_PROGRESS';
const FAILED = 'FAILED';
const STOP_REQUESTED = 'STOP_REQUESTED';
const STOPPED = 'STOPPED';
/* grouping statuses */
const STATUS_PROCESSING = [
  SUBMITTED,
  IN_PROGRESS,
];
const STATUS_FAILED = [
  FAILED,
  STOP_REQUESTED,
  STOPPED,
];

class StateCheckCustomEntityStatus extends BaseStateStartComprehend {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: () => {},
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateCheckCustomEntityStatus';
  }

  async process() {
    const jobId = this.stateData.data[CATEGORY][SUB_CATEGORY].jobId;
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    const response = await comprehend.describeEntitiesDetectionJob({
      JobId: jobId,
    }).promise();

    const jobStatus = response.EntitiesDetectionJobProperties.JobStatus;
    return (STATUS_PROCESSING.indexOf(jobStatus) >= 0)
      ? this.onProgress(response)
      : (STATUS_FAILED.indexOf(jobStatus) >= 0)
        ? this.onError(response)
        : this.onCompleted(response);
  }

  async onCompleted(data) {
    await this.removeBacklogItem(data.EntitiesDetectionJobProperties.JobStatus)
      .catch(() => undefined);

    const uri = new URL(data.EntitiesDetectionJobProperties.OutputDataConfig.S3Uri);
    const key = uri.pathname.slice(1);
    this.stateData.setData(CATEGORY, {
      [SUB_CATEGORY]: {
        ...this.stateData.data[CATEGORY][SUB_CATEGORY],
        output: key,
      },
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async onError(data) {
    await this.removeBacklogItem(data.EntitiesDetectionJobProperties.JobStatus)
      .catch(() => undefined);
    this.stateData.setFailed(data.EntitiesDetectionJobProperties.Message);
    return this.stateData.toJSON();
  }

  async onProgress(data) {
    this.stateData.setProgress(1);
    return this.stateData.toJSON();
  }

  async removeBacklogItem(jobStatus) {
    const jobId = this.stateData.data[CATEGORY][SUB_CATEGORY].jobId;
    const backlog = new BacklogJob();
    return backlog.deleteJob(jobId, jobStatus);
  }
}

module.exports = StateCheckCustomEntityStatus;
