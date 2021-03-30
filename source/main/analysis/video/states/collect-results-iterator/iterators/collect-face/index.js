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

const SUBCATEGORY = AnalysisTypes.Rekognition.Face;
const NAMED_KEY = 'Faces';

class CollectFaceIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
    this.$func = rekog.getFaceDetection.bind(rekog);
  }

  get [Symbol.toStringTag]() {
    return 'CollectFaceIterator';
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.map(x =>
      (x.Face.Gender || {}).Value).filter(x => x);
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

module.exports = CollectFaceIterator;
