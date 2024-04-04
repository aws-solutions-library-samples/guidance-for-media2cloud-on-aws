// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
  CommonUtils,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Face;

class CreateFaceTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'CreateFaceTrackIterator';
  }

  filterBy(name, data) {
    if (!data || !data.Faces || !data.Faces.length) {
      return [];
    }
    return data.Faces
      .filter((x) =>
        (((x || {}).Face || {}).Gender || {}).Value === name);
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      if (!dataset.Face.BoundingBox || !dataset.Face.Gender) {
        continue;
      }
      const desc = [];
      if (dataset.Face.AgeRange) {
        desc.push(`Age: ${dataset.Face.AgeRange.Low}-${dataset.Face.AgeRange.High}`);
      }
      if (dataset.Face.Emotions) {
        const emotion = dataset.Face.Emotions
          .sort((a, b) =>
            b.Confidence - a.Confidence)
          .shift();
        desc.push(`${emotion.Type} (${Number(emotion.Confidence.toFixed(2))}%)`);
      }
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      timestamps[dataset.Timestamp].push({
        c: Number(dataset.Face.Gender.Confidence.toFixed(2)),
        w: Number(dataset.Face.BoundingBox.Width.toFixed(4)),
        h: Number(dataset.Face.BoundingBox.Height.toFixed(4)),
        l: Number(dataset.Face.BoundingBox.Left.toFixed(4)),
        t: Number(dataset.Face.BoundingBox.Top.toFixed(4)),
        desc: (!desc.length) ? undefined : desc.join(';'),
      });
    }
    if (!Object.keys(timestamps)) {
      return undefined;
    }
    return {
      label: name,
      data: Object.keys(timestamps)
        .map((x) => ({
          x: Number(x),
          y: timestamps[x].length,
          details: timestamps[x],
        })),
    };
  }
}

module.exports = CreateFaceTrackIterator;
