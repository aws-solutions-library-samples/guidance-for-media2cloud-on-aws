// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStartDetectionIterator = require('../shared/baseStartDetectionIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;
const GRID_SIZE = 1 / 3;

class StartTextIterator extends BaseStartDetectionIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
    const backlog = new BacklogClient.RekognitionBacklogJob();
    this.$func = backlog.startTextDetection.bind(backlog);
    const data = stateData.data[SUBCATEGORY];
    const regionsOfInterest = StartTextIterator.computeRegionsOfInterest(data.textROI);
    this.$paramOptions = {
      Filters: {
        WordFilter: {
          MinConfidence: data.minConfidence,
        },
        RegionsOfInterest: regionsOfInterest,
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'StartTextIterator';
  }

  static computeRegionsOfInterest(regionsOfInterest) {
    if (!regionsOfInterest || !Array.isArray(regionsOfInterest) || regionsOfInterest.length !== 9) {
      return undefined;
    }
    const boundingBoxes = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (regionsOfInterest[row * 3 + col]) {
          boundingBoxes.push({
            BoundingBox: {
              Top: row * GRID_SIZE,
              Left: col * GRID_SIZE,
              Width: GRID_SIZE,
              Height: GRID_SIZE,
            },
          });
        }
      }
    }
    return (boundingBoxes.length === 0 || boundingBoxes.length === 9)
      ? undefined
      : boundingBoxes;
  }
}

module.exports = StartTextIterator;
