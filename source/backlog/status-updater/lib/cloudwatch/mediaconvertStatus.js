// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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

  get errorMessage() {
    return this.detail.errorMessage;
  }

  async process() {
    /* optional output */
    let optional;
    if (this.errorMessage) {
      optional = {
        ...optional,
        errorMessage: this.errorMessage,
      };
    }
    const backlog = new BacklogJob();
    return backlog.deleteJob(this.jobId, this.status, optional);
  }
}

module.exports = MediaConvertStatus;
