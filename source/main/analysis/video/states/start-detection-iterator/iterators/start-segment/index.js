// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes: {
    Rekognition: {
      Segment,
    },
  },
} = require('core-lib');
const {
  BacklogClient: {
    RekognitionBacklogJob,
  },
} = require('service-backlog-lib');
const BaseStartDetectionIterator = require('../shared/baseStartDetectionIterator');

const MINCONFIDENCE = 55;
const DEFAULT_FILTER_SETTINGS = {
  BlackFrame: {
    MaxPixelThreshold: 0.1, // default is 0.2
    MinCoveragePercentage: 99.5, // default is 99%
  },
};

let FilterSettings = DEFAULT_FILTER_SETTINGS;
const SegmentTypes = ['SHOT'];

class StartSegmentIterator extends BaseStartDetectionIterator {
  constructor(stateData) {
    super(stateData, Segment);
    const backlog = new RekognitionBacklogJob();
    this.$func = backlog.startSegmentDetection.bind(backlog);
    const minConfidence = MINCONFIDENCE; // data.minConfidence;

    const {
      data,
    } = stateData;

    _setFilterSettings((data[Segment] || {}).filterSettings);

    this.$paramOptions = {
      SegmentTypes,
      Filters: {
        ShotFilter: {
          MinSegmentConfidence: minConfidence,
        },
        TechnicalCueFilter: {
          MinSegmentConfidence: minConfidence,
          ...FilterSettings,
        },
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'StartSegmentIterator';
  }
}

function _setFilterSettings(userFilterSettings = {}) {
  try {
    const {
      maxPixelThreshold = 0.15,
      minCoveragePercentage = 98,
      enableTechnicalCue = true,
    } = userFilterSettings;

    if (enableTechnicalCue && !SegmentTypes.includes('TECHNICAL_CUE')) {
      SegmentTypes.push('TECHNICAL_CUE');
    }

    let _maxPixelThreshold = Number(maxPixelThreshold);
    let _minCoveragePercentage = Number(minCoveragePercentage);

    if (
      Number.isNaN(_maxPixelThreshold) ||
      Number.isNaN(_minCoveragePercentage)
    ) {
      return;
    }

    _maxPixelThreshold = Math.min(
      Math.max(_maxPixelThreshold, 0),
      0.99
    );

    _minCoveragePercentage = Math.min(
      Math.max(_minCoveragePercentage, 0),
      100
    );

    // apply user defined settings
    FilterSettings = {
      BlackFrame: {
        MaxPixelThreshold: _maxPixelThreshold,
        MinCoveragePercentage: _minCoveragePercentage,
      },
    };
  } catch (e) {
    // do nothing
  }
}

module.exports = StartSegmentIterator;
