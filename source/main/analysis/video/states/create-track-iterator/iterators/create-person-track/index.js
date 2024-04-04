// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Person;

class CreatePersonTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreatePersonTrackIterator';
  }

  get enableVtt() {
    return false;
  }

  filterBy(name, data) {
    if (!data || !data.Persons || !data.Persons.length) {
      return [];
    }
    return data.Persons
      .filter((x) =>
        String((x.Person || {}).Index) === name);
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    let desc;
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const details = dataset.Person;
      if (!details.BoundingBox) {
        continue;
      }
      if (!desc) {
        desc = `Index ${details.Index}`;
      }
      const xy = ((details.Face || {}).BoundingBox)
        ? {
          c: Number(details.Face.Confidence.toFixed(2)),
          w: Number(details.Face.BoundingBox.Width.toFixed(4)),
          h: Number(details.Face.BoundingBox.Height.toFixed(4)),
          l: Number(details.Face.BoundingBox.Left.toFixed(4)),
          t: Number(details.Face.BoundingBox.Top.toFixed(4)),
        }
        : undefined;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number((details.Confidence || 0).toFixed(2)),
        w: Number(details.BoundingBox.Width.toFixed(4)),
        h: Number(details.BoundingBox.Height.toFixed(4)),
        l: Number(details.BoundingBox.Left.toFixed(4)),
        t: Number(details.BoundingBox.Top.toFixed(4)),
        xy,
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

module.exports = CreatePersonTrackIterator;
