/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  AnalysisTypes,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStartDetectionIterator = require('../shared/baseStartDetectionIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Segment;

class StartSegmentIterator extends BaseStartDetectionIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
    const backlog = new BacklogClient.RekognitionBacklogJob();
    this.$func = backlog.startSegmentDetection.bind(backlog);
    const data = stateData.data[SUBCATEGORY];
    this.$paramOptions = {
      SegmentTypes: [
        'TECHNICAL_CUE',
        'SHOT',
      ],
      Filters: {
        ShotFilter: {
          MinSegmentConfidence: data.minConfidence,
        },
        TechnicalCueFilter: {
          MinSegmentConfidence: data.minConfidence,
        },
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'StartSegmentIterator';
  }
}

module.exports = StartSegmentIterator;
