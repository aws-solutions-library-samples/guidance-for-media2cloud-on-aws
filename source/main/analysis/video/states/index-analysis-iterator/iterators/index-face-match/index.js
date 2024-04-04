// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  AnalysisTypes,
} = require('core-lib');
const BaseAnalysisIndexer = require('../shared/baseAnalysisIndexer');

const SUBCATEGORY = AnalysisTypes.Rekognition.FaceMatch;

class IndexFaceMatchIterator extends BaseAnalysisIndexer {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'IndexFaceMatchIterator';
  }

  parseMetadata(data) {
    return Object.keys(data)
      .map((name) => ({
        name,
        faceId: (data[name][0] || {}).faceId,
        timecodes: data[name]
          .map((x) => ({
            begin: x.begin,
            end: x.end,
          })),
      }))
      .filter((x) =>
        x.timecodes.length > 0);
  }
}

module.exports = IndexFaceMatchIterator;
