// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  BacklogJob,
} = require('service-backlog-lib');

class SnsStatus {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
    this.$message = JSON.parse(event.Records[0].Sns.Message);
    this.$timestamp = new Date(event.Records[0].Sns.Timestamp).getTime();
    this.$token = undefined;
    this.$api = undefined;
    this.$service = undefined;
    this.$stateData = undefined;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get token() {
    return this.$token;
  }

  set token(val) {
    this.$token = val;
  }

  get service() {
    return this.$service;
  }

  set service(val) {
    this.$service = val;
  }

  get api() {
    return this.$api;
  }

  set api(val) {
    this.$api = val;
  }

  get stateData() {
    return this.$stateData;
  }

  set stateData(val) {
    this.$stateData = val;
  }

  get message() {
    return this.$message;
  }

  get timestamp() {
    return this.$timestamp;
  }

  async process() {
    /* note: different service sns message uses different key name for job id */
    const jobId = this.message.JobId || this.message.jobId;
    const backlog = new BacklogJob();
    return backlog.deleteJob(jobId, this.message.Status);
  }
}

module.exports = SnsStatus;
