/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.FaceMatch;
const NAMED_KEY = 'Persons';

class CollectFaceMatchIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
    this.$func = rekog.getFaceSearch.bind(rekog);
    this.$paramOptions = {
      SortBy: 'TIMESTAMP',
    };
  }

  get [Symbol.toStringTag]() {
    return 'CollectFaceMatchIterator';
  }

  parseResults(data) {
    /* pick the best matched face by the similarity score */
    data[NAMED_KEY].map((person) => {
      const filtered = (person.FaceMatches || []).filter(x =>
        x.Face.ExternalImageId).sort((a, b) =>
        b.Similarity - a.Similarity);
      if (filtered.length) {
        const bestMatched = filtered.shift();
        bestMatched.Timestamp = person.Timestamp;
        person.FaceMatches = [bestMatched];
      }
      return person.FaceMatches;
    });
    return data[NAMED_KEY];
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.reduce((a0, c0) =>
      a0.concat((c0.FaceMatches || []).map(x0 =>
        (x0.Face || {}).ExternalImageId).filter(x => x)), []);
    keys = [...new Set(keys)];
    while (keys.length) {
      const key = keys.shift();
      const unique = new Set(mapData[key]);
      unique.add(seqFile);
      mapData[key] = [...unique];
    }
    return mapData;
  }
}

module.exports = CollectFaceMatchIterator;
