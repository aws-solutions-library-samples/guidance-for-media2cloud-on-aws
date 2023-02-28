// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
    let instance;
    switch (this.source) {
      case MediaConvertStatus.SourceType:
        instance = new MediaConvertStatus(this);
        break;
      case TranscribeStatus.SourceType:
        instance = new TranscribeStatus(this);
        break;
      case CustomLabelsStateMachineStatus.SourceType:
        instance = new CustomLabelsStateMachineStatus(this);
        break;
      default:
        instance = undefined;
    }
    
    if (!instance) {
      throw new Error(`${this.source} not supported`);
    }
    return instance.process();
  }
}

module.exports = CloudWatchStatus;
