// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes: {
    Rekognition: {
      FaceMatch,
    },
  }, FaceIndexer,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

class CreateFaceMatchTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, FaceMatch);
  }

  get [Symbol.toStringTag]() {
    return 'CreateFaceMatchTrackIterator';
  }

  filterBy(name, data) {
    if (!data || !data.Persons || !data.Persons.length) {
      return [];
    }

    return data.Persons
      .filter((x) => {
        const face = (((x || {}).FaceMatches || [])[0] || {}).Face;

        if (!face) {
          return false;
        }

        const faceId = face.FaceId;
        let _name = face.Name;
        if (!_name) {
          _name = FaceIndexer.resolveExternalImageId(
            face.ExternalImageId,
            faceId
          );
        }

        return (name === _name);
      });
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
          w: Number(dataset.Person.Face.BoundingBox.Width.toFixed(4)),
          h: Number(dataset.Person.Face.BoundingBox.Height.toFixed(4)),
          l: Number(dataset.Person.Face.BoundingBox.Left.toFixed(4)),
          t: Number(dataset.Person.Face.BoundingBox.Top.toFixed(4)),
        }
        : undefined;
      timestamps[dataset.Timestamp] = timestamps[dataset.Timestamp] || [];
      if (!dataset.Person.BoundingBox) {
        timestamps[dataset.Timestamp].push({
          ...xy,
          c: Number(dataset.FaceMatches[0].Similarity.toFixed(2)),
        });
      } else {
        timestamps[dataset.Timestamp].push({
          c: Number(dataset.FaceMatches[0].Similarity.toFixed(2)),
          w: Number(dataset.Person.BoundingBox.Width.toFixed(4)),
          h: Number(dataset.Person.BoundingBox.Height.toFixed(4)),
          l: Number(dataset.Person.BoundingBox.Left.toFixed(4)),
          t: Number(dataset.Person.BoundingBox.Top.toFixed(4)),
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
      data: Object.keys(timestamps)
        .map(x => ({
          x: Number(x),
          y: timestamps[x].length,
          details: timestamps[x],
        })),
    };
  }
}

module.exports = CreateFaceMatchTrackIterator;
