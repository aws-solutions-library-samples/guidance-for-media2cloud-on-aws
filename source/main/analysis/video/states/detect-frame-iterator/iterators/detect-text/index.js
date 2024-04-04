// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DetectTextCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;
const NAMED_KEY = 'TextDetections';
const GRID_SIZE = 1 / 3;
const SKIP_FRAME_ANALYSIS = [
  'ColorBars',
  'BlackFrames',
  // 'StudioLogo',
  // 'Slate',
  // 'EndCredits',
  // 'OpeningCredits',
  // 'Content',
  // 'undefined',
];

class DetectTextIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    /* configure api parameters */
    const data = stateData.data[SUBCATEGORY];
    const paramOptions = {
      Filters: {
        WordFilter: {
          MinConfidence: data.minConfidence,
        },
      },
    };
    const textROI = DetectTextIterator.computeRegionsOfInterest(data.textROI);
    if (textROI && textROI.length > 0) {
      paramOptions.Filters.RegionsOfInterest = textROI;
    }
    this.$paramOptions = paramOptions;
  }

  get [Symbol.toStringTag]() {
    return 'DetectTextIterator';
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

  async detectFrame(bucket, key, frameNo, timestamp) {
    const params = this.makeParams(bucket, key, this.paramOptions);
    const command = new DetectTextCommand(params);

    return this.detectFn(command)
      .then((res) =>
        this.parseTextResult(res, frameNo, timestamp));
  }

  parseTextResult(data, frameNo, timestamp) {
    if (!data || !data.TextDetections || !data.TextDetections.length) {
      return undefined;
    }

    if (!this.modelMetadata) {
      this.modelMetadata = {
        TextModelVersion: data.TextModelVersion,
      };
    }

    const minConfidence = this.minConfidence;
    const filtered = data.TextDetections
      .filter((x) =>
        x.Type === 'LINE'
        && x.Confidence >= minConfidence);

    return filtered
      .map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        TextDetection: x,
      }));
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.TextDetection.DetectedText)),
    ];
  }

  skipFrame(frame) {
    return SKIP_FRAME_ANALYSIS
      .includes((frame || {}).technicalCueType);
  }
}

module.exports = DetectTextIterator;
