// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  AnalysisTypes,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStartDetectionIterator = require('../shared/baseStartDetectionIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.FaceMatch;

class StartFaceMatchIterator extends BaseStartDetectionIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
    const backlog = new BacklogClient.RekognitionBacklogJob();
    this.$func = backlog.startFaceSearch.bind(backlog);
    const data = stateData.data[SUBCATEGORY];
    this.$paramOptions = {
      CollectionId: data.faceCollectionId,
      FaceMatchThreshold: data.minConfidence,
    };
  }

  get [Symbol.toStringTag]() {
    return 'StartFaceMatchIterator';
  }
}

module.exports = StartFaceMatchIterator;
