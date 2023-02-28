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

  async downloadSelected(bucket, key, name) {
    return this.downloadJson(bucket, key, name);
  }

  async downloadJson(bucket, key, name) {
    const data = await CommonUtils.download(bucket, key)
      .then(x => JSON.parse(x));
    return ((data || {}).TextDetections || []).filter(x =>
      (x.TextDetection.DetectedText === name && x.TextDetection.Type === 'LINE'));
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    for (let dataset of datasets) {
      const box = dataset.TextDetection.Geometry.BoundingBox;
      if (!box) {
        continue;
      }
      const confidence = Number(Number(dataset.TextDetection.Confidence).toFixed(2));
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: confidence,
        w: Number(Number(box.Width).toFixed(4)),
        h: Number(Number(box.Height).toFixed(4)),
        l: Number(Number(box.Left).toFixed(4)),
        t: Number(Number(box.Top).toFixed(4)),
      });
    }
    if (!Object.keys(timestamps)) {
      return undefined;
    }
    return {
      label: name,
      data: Object.keys(timestamps).map(x => ({
        x: Number(x),
        y: timestamps[x].length,
        details: timestamps[x],
      })),
    };
  }
}

module.exports = CreateTextTrackIterator;
