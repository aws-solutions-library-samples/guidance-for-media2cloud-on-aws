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

const SUBCATEGORY = AnalysisTypes.Rekognition.Text;
const NAMED_KEY = 'TextDetections';

class CollectTextIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
    this.$func = rekog.getTextDetection.bind(rekog);
  }

  get [Symbol.toStringTag]() {
    return 'CollectTextIterator';
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    return undefined;
  }
}

module.exports = CollectTextIterator;
