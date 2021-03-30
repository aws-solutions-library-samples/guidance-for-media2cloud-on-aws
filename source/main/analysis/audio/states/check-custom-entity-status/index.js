/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const URL = require('url');
const PATH = require('path');
const {
  AnalysisError,
  CommonUtils,
  TarStreamHelper,
} = require('core-lib');
const {
  BacklogJob,
} = require('service-backlog-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const CATEGORY = 'comprehend';
const SUB_CATEGORY = 'custom-entity';
const DOC_BASENAME = 'document';
const ENTITY_OUTPUT = 'output';
/* comprehend Job Status */
const SUBMITTED = 'SUBMITTED';
const IN_PROGRESS = 'IN_PROGRESS';
const COMPLETED = 'COMPLETED';
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
    const uri = URL.parse(data.EntitiesDetectionJobProperties.OutputDataConfig.S3Uri);
    const key = uri.pathname.slice(1);
    let bucket = uri.hostname;

    await this.removeBacklogItem(data.EntitiesDetectionJobProperties.JobStatus)
      .catch(() => undefined);

    const results = await TarStreamHelper.extract(bucket, key);
    if (!results[ENTITY_OUTPUT]) {
      throw new AnalysisError('fail to extract output.tar.gz');
    }
    let lines = results[ENTITY_OUTPUT].toString()
      .split('\n')
      .filter(x => x)
      .map(x => JSON.parse(x));

    const totalEntities = lines.reduce((a0, c0) =>
      a0 + c0.Entities.length, 0);

    this.stateData.setData(CATEGORY, {
      [SUB_CATEGORY]: {
        ...this.stateData.data[CATEGORY][SUB_CATEGORY],
        endTime: new Date().getTime(),
        totalEntities,
      },
    });
    if (!totalEntities) {
      this.stateData.setNoData();
      return this.stateData.toJSON();
    }

    const re = new RegExp(`${DOC_BASENAME}-([0-9]+).txt`);
    lines = lines.map(x => ({
      ...x,
      FileIdx: Number.parseInt(x.File.match(re)[1], 10),
    })).sort((a, b) => ((a.FileIdx < b.FileIdx)
      ? -1
      : (a.FileIdx > b.FileIdx)
        ? 1
        : a.Line - b.Line));

    const numOutputs = this.stateData.data[CATEGORY][SUB_CATEGORY].numOutputs;
    const parsed = Array.from({
      length: numOutputs,
    }, () => []);
    while (lines.length) {
      const line = lines.shift();
      parsed[line.FileIdx].splice(parsed[line.FileIdx].length, 0, ...line.Entities);
    }

    bucket = this.stateData.input.destination.bucket;
    const prefix = this.stateData.data[CATEGORY][SUB_CATEGORY].prefix;
    const name = `${ENTITY_OUTPUT}.json`;
    await CommonUtils.uploadFile(bucket, prefix, name, parsed);

    this.stateData.setData(CATEGORY, {
      [SUB_CATEGORY]: {
        ...this.stateData.data[CATEGORY][SUB_CATEGORY],
        output: PATH.join(prefix, name),
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
