// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const {
  BacklogJob,
} = require('service-backlog-lib');

class MediaConvertStatus {
  constructor(parent) {
    this.$parent = parent;
  }

  static get SourceType() {
    return 'aws.mediaconvert';
  }

  get parent() {
    return this.$parent;
  }

  get event() {
    return this.parent.event;
  }

  get context() {
    return this.parent.context;
  }

  get detail() {
    return this.parent.detail;
  }

  get status() {
    return this.detail.status;
  }

  get jobId() {
    return this.detail.jobId;
  }

  async process() {
    const backlog = new BacklogJob();
    return backlog.deleteJob(this.jobId, this.status);
  }
}

module.exports = MediaConvertStatus;
