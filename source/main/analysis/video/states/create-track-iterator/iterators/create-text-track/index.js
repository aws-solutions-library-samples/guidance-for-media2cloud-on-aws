// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;

class CreateTextTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateTextTrackIterator';
  }

  get enableVtt() {
    return false;
  }

  filterBy(name, data) {
    if (!data || !data.TextDetections || !data.TextDetections.length) {
      return [];
    }
    return data.TextDetections
      .filter((x) =>
        (x.TextDetection || {}).DetectedText === name);
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const box = dataset.TextDetection.Geometry.BoundingBox;
      if (!box) {
        continue;
      }
      const confidence = Number(dataset.TextDetection.Confidence.toFixed(2));
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: confidence,
        w: Number(box.Width.toFixed(4)),
        h: Number(box.Height.toFixed(4)),
        l: Number(box.Left.toFixed(4)),
        t: Number(box.Top.toFixed(4)),
      });
    }
    if (!Object.keys(timestamps)) {
      return undefined;
    }

    return {
      label: name,
      data: Object.keys(timestamps)
        .map(x => ({
          x: Number(x),
          y: timestamps[x].length,
          details: timestamps[x],
        })),
    };
  }
}

module.exports = CreateTextTrackIterator;
