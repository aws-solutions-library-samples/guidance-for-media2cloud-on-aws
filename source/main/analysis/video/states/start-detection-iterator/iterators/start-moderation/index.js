// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStartDetectionIterator = require('../shared/baseStartDetectionIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Moderation;

class StartModerationIterator extends BaseStartDetectionIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
    const backlog = new BacklogClient.RekognitionBacklogJob();
    this.$func = backlog.startContentModeration.bind(backlog);
    const data = stateData.data[SUBCATEGORY];
    this.$paramOptions = {
      MinConfidence: data.minConfidence,
    };
  }

  get [Symbol.toStringTag]() {
    return 'StartModerationIterator';
  }
}

module.exports = StartModerationIterator;
