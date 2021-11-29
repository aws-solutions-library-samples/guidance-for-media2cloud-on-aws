// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  AnalysisTypes,
  Environment,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Segment;
const NAMED_KEY = 'Segments';

class CollectSegmentIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    this.$func = rekog.getSegmentDetection.bind(rekog);
    this.$responseMetadata = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'CollectSegmentIterator';
  }

  get responseMetadata() {
    return this.$responseMetadata;
  }

  set responseMetadata(val) {
    this.$responseMetadata = val;
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    return undefined;
  }

  async getDetectionResults(params) {
    return super.getDetectionResults(params)
      .then((data) => {
        if (!this.responseMetadata) {
          this.responseMetadata = {
            VideoMetadata: data.VideoMetadata,
            AudioMetadata: data.AudioMetadata,
            SelectedSegmentTypes: data.SelectedSegmentTypes,
          };
        }
        return data;
      });
  }

  async uploadFile(bucket, prefix, seqFile, data) {
    return super.uploadFile(bucket, prefix, seqFile, {
      [NAMED_KEY]: data,
      ...this.responseMetadata,
    });
  }
}

module.exports = CollectSegmentIterator;
