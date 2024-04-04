// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Label;

class CreateLabelTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateLabelTrackIterator';
  }

  filterBy(name, data) {
    if (!data || !data.Labels || !data.Labels.length) {
      return [];
    }
    return data.Labels
      .filter((x) =>
        ((x || {}).Label || {}).Name === name);
  }

  createTimeseriesData(name, datasets) {
    let desc;
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      if (!desc && (dataset.Label.Parents || []).length > 0) {
        desc = dataset.Label.Parents
          .map((x) =>
            x.Name)
          .join(';');
      }
      /* case 1: use instance's score */
      const boxes = (dataset.Label.Instances || []).map(x => ({
        c: Number(x.Confidence.toFixed(2)),
        w: Number(x.BoundingBox.Width.toFixed(4)),
        h: Number(x.BoundingBox.Height.toFixed(4)),
        l: Number(x.BoundingBox.Left.toFixed(4)),
        t: Number(x.BoundingBox.Top.toFixed(4)),
      }));
      /* case 2: if no bounding box, use label's score */
      if (!boxes.length) {
        boxes.push({
          c: Number(dataset.Label.Confidence.toFixed(2)),
        });
      }
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].splice(
        timestamps[dataset.Timestamp].length,
        0,
        ...boxes
      );
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

module.exports = CreateLabelTrackIterator;
