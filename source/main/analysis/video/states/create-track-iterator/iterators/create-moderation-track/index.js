// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Moderation;

class CreateModerationTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateModerationTrackIterator';
  }

  filterBy(name, data) {
    if (!data || !data.ModerationLabels || !data.ModerationLabels.length) {
      return [];
    }

    return data.ModerationLabels
      .filter((x) =>
        x.ModerationLabel !== undefined
        && (x.ModerationLabel.Name === name
          || x.ModerationLabel.ParentName === name));
  }

  createTimeseriesData(name, datasets) {
    let desc;
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      if (!desc && dataset.ModerationLabel.ParentName) {
        desc = dataset.ModerationLabel.ParentName;
      }
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number(dataset.ModerationLabel.Confidence.toFixed(2)),
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

module.exports = CreateModerationTrackIterator;
