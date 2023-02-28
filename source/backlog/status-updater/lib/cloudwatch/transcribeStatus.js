// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  BacklogJob,
} = require('service-backlog-lib');

const STATUS_COMPLETED = 'COMPLETED';
const STATUS_FAILED = 'FAILED';

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
    return this.detail.TranscriptionJobStatus;
  }

  get failureReason() {
    return this.detail.FailureReason;
  }

  get jobId() {
    return this.detail.TranscriptionJobName;
  }

  async process() {
    /* optional output */
    let optional;
    if (this.failureReason) {
      optional = {
        ...optional,
        errorMessage: this.failureReason,
      };
    }
    const backlog = new BacklogJob();
    return backlog.deleteJob(this.jobId, this.status, optional);
  }
}

module.exports = TranscribeStatus;
