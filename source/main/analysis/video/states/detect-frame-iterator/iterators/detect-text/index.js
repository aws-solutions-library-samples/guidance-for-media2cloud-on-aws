// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;
const NAMED_KEY = 'TextDetections';
const GRID_SIZE = 1 / 3;

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

  async detectFrame(bucket, key, frameNo, timestamp) {
    const fn = this.rekog.detectText.bind(this.rekog);
    const params = this.makeParams(bucket, key, this.paramOptions);
    return this.detectFn(fn, params)
      .then(result =>
        this.parseTextResult(result, frameNo, timestamp));
  }

  parseTextResult(data, frameNo, timestamp) {
    return (!data || !data.TextDetections || !data.TextDetections.length)
      ? undefined
      : data.TextDetections.map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        TextDetection: x,
      }));
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.map(x =>
      (x.TextDetection || {}).DetectedText).filter(x => x);
    keys = [...new Set(keys)];
    while (keys.length) {
      const key = keys.shift();
      const unique = new Set(mapData[key]);
      unique.add(seqFile);
      mapData[key] = [...unique];
    }
    return mapData;
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

module.exports = DetectTextIterator;
