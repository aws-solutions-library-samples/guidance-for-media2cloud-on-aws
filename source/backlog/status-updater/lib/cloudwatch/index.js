// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
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
      throw new Error(`${this.source} not supported`);
    }
    return instance.process();
  }
}

module.exports = CloudWatchStatus;
