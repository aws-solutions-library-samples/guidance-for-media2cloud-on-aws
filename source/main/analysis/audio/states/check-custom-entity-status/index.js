// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ComprehendClient,
  DescribeEntitiesDetectionJobCommand,
} = require('@aws-sdk/client-comprehend');
const {
  AnalysisTypes,
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
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
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

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

    const comprehendClient = xraysdkHelper(new ComprehendClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DescribeEntitiesDetectionJobCommand({
      JobId: jobId,
    });

    const response = await comprehendClient.send(command);

    const status = response.EntitiesDetectionJobProperties.JobStatus;
    if (STATUS_PROCESSING.includes(status)) {
      return this.onProgress(response);
    }
    if (STATUS_FAILED.includes(status)) {
      return this.onError(response);
    }
    return this.onCompleted(response);
  }

  async onCompleted(data) {
    await this.removeBacklogItem(data.EntitiesDetectionJobProperties.JobStatus)
      .catch(() =>
        undefined);

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
      .catch(() =>
        undefined);
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
