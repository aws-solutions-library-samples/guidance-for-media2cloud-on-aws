// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DetectFacesCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Face;
const NAMED_KEY = 'Faces';

class DetectFaceIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      Attributes: [
        'ALL',
      ],
    };
  }

  get [Symbol.toStringTag]() {
    return 'DetectFaceIterator';
  }

  async detectFrame(bucket, key, frameNo, timestamp) {
    const params = this.makeParams(bucket, key, this.paramOptions);
    const command = new DetectFacesCommand(params);

    return this.detectFn(command)
      .then((res) =>
        this.parseFaceResult(res, frameNo, timestamp));
  }

  parseFaceResult(data, frameNo, timestamp) {
    if (!data || !data.FaceDetails || !data.FaceDetails.length) {
      return undefined;
    }

    const minConfidence = this.minConfidence;
    const filtered = data.FaceDetails
      .filter((x) =>
        x.Gender
        && x.Gender.Value
        && x.Confidence >= minConfidence);
    if (!filtered.length) {
      return undefined;
    }

    return filtered
      .map((x) => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        Face: x,
      }));
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          x.Face.Gender.Value)),
    ];
  }
}

module.exports = DetectFaceIterator;
