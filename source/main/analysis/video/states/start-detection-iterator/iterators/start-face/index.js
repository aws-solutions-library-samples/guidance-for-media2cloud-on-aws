// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStartDetectionIterator = require('../shared/baseStartDetectionIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Face;

class StartFaceIterator extends BaseStartDetectionIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
    const backlog = new BacklogClient.RekognitionBacklogJob();
    this.$func = backlog.startFaceDetection.bind(backlog);
    this.$paramOptions = {
      FaceAttributes: 'ALL',
    };
  }

  get [Symbol.toStringTag]() {
    return 'StartFaceIterator';
  }
}

module.exports = StartFaceIterator;
