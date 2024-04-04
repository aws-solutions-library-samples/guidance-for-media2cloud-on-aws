// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Celeb;

class CreateCelebTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateCelebTrackIterator';
  }

  filterBy(name, data) {
    if (!data || !data.Celebrities || !data.Celebrities.length) {
      return [];
    }
    return data.Celebrities
      .filter((x) =>
        (x.Celebrity || {}).Name === name);
  }

  createTimeseriesData(name, datasets) {
    let desc;
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const box = dataset.Celebrity.BoundingBox || (dataset.Celebrity.Face || {}).BoundingBox;
      if (!box) {
        continue;
      }
      if (!desc && (dataset.Celebrity.Urls || []).length > 0) {
        desc = dataset.Celebrity.Urls[0];
      }
      const confidence = dataset.Celebrity.Confidence || (dataset.Celebrity.Face || {}).Confidence;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number(confidence.toFixed(2)),
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
      desc,
      data: Object.keys(timestamps)
        .map(x => ({
          x: Number(x),
          y: timestamps[x].length,
          details: timestamps[x],
        })),
    };
  }
}

module.exports = CreateCelebTrackIterator;
