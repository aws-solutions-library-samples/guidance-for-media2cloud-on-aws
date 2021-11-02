// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.FaceMatch;

class CreateFaceMatchTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateFaceMatchTrackIterator';
  }

  async downloadSelected(bucket, key, name) {
    return this.downloadJson(bucket, key, name);
  }

  async downloadJson(bucket, key, name) {
    const datasets = await CommonUtils.download(bucket, key)
      .then(x => JSON.parse(x));
    const selected = [];
    for (let i = 0; i < datasets.Persons.length; i++) {
      const item = datasets.Persons[i];
      if (item.FaceMatches && item.FaceMatches.length) {
        const bestMatch = item.FaceMatches.filter(x =>
          x.Face.ExternalImageId === name)
          .sort((a, b) =>
            b.Similarity - a.Similarity)
          .shift();
        if (bestMatch) {
          item.FaceMatches = [bestMatch];
          selected.push(item);
        }
      }
    }
    return selected;
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    let desc;
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      if (!(dataset.FaceMatches || [])[0]) {
        continue;
      }
      if (!desc) {
        desc = `Index ${dataset.Person.Index}`;
      }
      const xy = ((dataset.Person.Face || {}).BoundingBox)
        ? {
          w: Number.parseFloat(dataset.Person.Face.BoundingBox.Width.toFixed(4)),
          h: Number.parseFloat(dataset.Person.Face.BoundingBox.Height.toFixed(4)),
          l: Number.parseFloat(dataset.Person.Face.BoundingBox.Left.toFixed(4)),
          t: Number.parseFloat(dataset.Person.Face.BoundingBox.Top.toFixed(4)),
        }
        : undefined;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      if (!dataset.Person.BoundingBox) {
        timestamps[dataset.Timestamp].push({
          ...xy,
          c: Number.parseFloat(dataset.FaceMatches[0].Similarity.toFixed(2)),
        });
      } else {
        timestamps[dataset.Timestamp].push({
          c: Number.parseFloat(dataset.FaceMatches[0].Similarity.toFixed(2)),
          w: Number.parseFloat(dataset.Person.BoundingBox.Width.toFixed(4)),
          h: Number.parseFloat(dataset.Person.BoundingBox.Height.toFixed(4)),
          l: Number.parseFloat(dataset.Person.BoundingBox.Left.toFixed(4)),
          t: Number.parseFloat(dataset.Person.BoundingBox.Top.toFixed(4)),
          xy,
        });
      }
    }
    if (!Object.keys(timestamps)) {
      return undefined;
    }
    return {
      label: name,
      desc,
      data: Object.keys(timestamps).map(x => ({
        x: Number.parseInt(x, 10),
        y: timestamps[x].length,
        details: timestamps[x],
      })),
    };
  }
}

module.exports = CreateFaceMatchTrackIterator;
