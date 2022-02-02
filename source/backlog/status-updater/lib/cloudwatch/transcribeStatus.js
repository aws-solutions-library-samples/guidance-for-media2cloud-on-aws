// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  BacklogJob,
} = require('service-backlog-lib');

class TranscribeStatus {
  constructor(parent) {
    this.$parent = parent;
  }

  static get SourceType() {
    return 'aws.transcribe';
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
    return this.event.detail.TranscriptionJobStatus;
  }

  get jobId() {
    return this.event.detail.TranscriptionJobName;
  }

  async process() {
    const backlog = new BacklogJob();
    return backlog.deleteJob(this.jobId, this.status);
  }
}

module.exports = TranscribeStatus;
