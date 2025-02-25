// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes: {
    Rekognition: {
      FaceMatch,
    },
  },
  CommonUtils: {
    download,
  },
  FaceIndexer,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

class CreateFaceMatchTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, FaceMatch);
  }

  get [Symbol.toStringTag]() {
    return 'CreateFaceMatchTrackIterator';
  }

  useSegment() {
    return true;
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

        if (face.Name === name || face.FaceId === name) {
          return true;
        }

        const resolvedName = FaceIndexer.resolveExternalImageId(face.ExternalImageId, face.FaceId);

        return (name === resolvedName);
      });
  }

  createTimeseriesData(name, datasets) {
    const timestamps = {};
    let desc;
    let faceId;
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      if (!(dataset.FaceMatches || [])[0]) {
        continue;
      }
      if (!faceId) {
        faceId = (dataset.FaceMatches[0].Face || {}).FaceId;
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
      faceId,
      data: Object.keys(timestamps)
        .map(x => ({
          x: Number(x),
          y: timestamps[x].length,
          details: timestamps[x],
        })),
    };
  }

  async getDataFile(bucket, key) {
    const dataset = await download(bucket, key)
      .then((res) =>
        JSON.parse(res))
      .catch((e) => {
        console.error(e);
        return undefined;
      });

    if (dataset === undefined) {
      return dataset;
    }

    // amending the facematch results
    const faceMap = {};
    for (const { FaceMatches } of dataset.Persons) {
      for (const face of FaceMatches) {
        const { Face: { FaceId: faceId } } = face;
        if (faceMap[faceId] === undefined) {
          faceMap[faceId] = [];
        }
        faceMap[faceId].push(face);
      }
    }

    const indexer = new FaceIndexer();
    let faceIds = Object.keys(faceMap);
    faceIds = await indexer.batchGet(faceIds);

    for (const item of faceIds) {
      const name = item.celeb;
      if (!name) {
        continue;
      }
      for (const face of faceMap[item.faceId]) {
        face.Face.Name = name;
      }
    }

    return dataset;
  }
}

module.exports = CreateFaceMatchTrackIterator;
