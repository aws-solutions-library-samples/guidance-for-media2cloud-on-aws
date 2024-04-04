// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  M2CException,
} = require('service-backlog-lib');
const MediaConvertStatus = require('./mediaconvertStatus');
const TranscribeStatus = require('./transcribeStatus');
const CustomLabelsStateMachineStatus = require('./customlabelsStateMachineStatus');

class CloudWatchStatus {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get source() {
    return this.event.source;
  }

  get detail() {
    return this.event.detail;
  }

  async process() {
    const instance = (this.source === MediaConvertStatus.SourceType)
      ? new MediaConvertStatus(this)
      : (this.source === TranscribeStatus.SourceType)
        ? new TranscribeStatus(this)
        : (this.source === CustomLabelsStateMachineStatus.SourceType)
          ? new CustomLabelsStateMachineStatus(this)
          : undefined;
    if (!instance) {
      throw new M2CException(`${this.source} not supported`);
    }
    return instance.process();
  }
}

module.exports = CloudWatchStatus;
