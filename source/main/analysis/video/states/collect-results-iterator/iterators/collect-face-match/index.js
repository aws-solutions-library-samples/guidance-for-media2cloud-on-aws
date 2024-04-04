// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  GetFaceSearchCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes: {
    Rekognition: {
      FaceMatch,
    },
  },
  FaceIndexer,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const NAMED_KEY = 'Persons';

class CollectFaceMatchIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, FaceMatch, NAMED_KEY);
    this.$paramOptions = {
      SortBy: 'TIMESTAMP',
    };
    this.$faceIndexer = new FaceIndexer();
  }

  get [Symbol.toStringTag]() {
    return 'CollectFaceMatchIterator';
  }

  get faceIndexer() {
    return this.$faceIndexer;
  }

  getRunCommand(params) {
    return new GetFaceSearchCommand(params);
  }

  async getDetectionResults(params) {
    let response = await super.getDetectionResults(params)
      .then((res) =>
        this.amendGetFaceSearchResponse(res));

    response = await response;

    return response;
  }

  parseResults(dataset) {
    const minConfidence = this.minConfidence;
    const parsed = [];
    /* pick the best matched face by the similarity score */
    while (dataset[NAMED_KEY].length) {
      const item = dataset[NAMED_KEY].shift();
      if (item.FaceMatches && item.FaceMatches.length > 0) {
        const bestMatched = item.FaceMatches
          .sort((a, b) =>
            b.Similarity - a.Similarity)
          .shift();
        if (bestMatched
          && (bestMatched.Face || {}).ExternalImageId
          && bestMatched.Similarity >= minConfidence) {
          parsed.push({
            ...item,
            FaceMatches: [
              bestMatched,
            ],
          });
        }
      }
    }
    return parsed;
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) => {
          const face = x.FaceMatches[0].Face;
          const faceId = face.FaceId;

          let name = face.Name;
          if (!name) {
            name = FaceIndexer.resolveExternalImageId(
              face.ExternalImageId,
              faceId
            );
          }
          return name;
        })),
    ];
  }

  async amendGetFaceSearchResponse(response) {
    // lookup faceId <-> celeb
    const facesToGet = [];

    response.Persons.forEach((person) => {
      person.FaceMatches.forEach((faceMatch) => {
        const face = faceMatch.Face;

        if (face === undefined) {
          return;
        }
        const found = this.faceIndexer.lookup(face.FaceId);
        if (found === undefined) {
          facesToGet.push(face);
        } else if (found && found.celeb) {
          face.Name = found.celeb;
        }
      });
    });

    if (facesToGet.length > 0) {
      const faceIds = facesToGet
        .map((x) =>
          x.FaceId);

      await this.faceIndexer.batchGet(faceIds)
        .then((res) => {
          if (res.length > 0) {
            facesToGet.forEach((face) => {
              const found = this.faceIndexer.lookup(face.FaceId);
              if (found && found.celeb) {
                face.Name = found.celeb;
              } else {
                // do not return external image id if it can't resolve the name!
                face.Name = FaceIndexer.resolveExternalImageId(
                  face.ExternalImageId,
                  false
                );
              }
            });
          }
          return res;
        });
    }

    return response;
  }
}

module.exports = CollectFaceMatchIterator;
