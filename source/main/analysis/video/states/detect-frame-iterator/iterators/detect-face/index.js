// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

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
    const fn = this.rekog.detectFaces.bind(this.rekog);
    const params = this.makeParams(bucket, key, this.paramOptions);
    return this.detectFn(fn, params)
      .then(result =>
        this.parseFaceResult(result, frameNo, timestamp));
  }

  parseFaceResult(data, frameNo, timestamp) {
    return (!data || !data.FaceDetails || !data.FaceDetails.length)
      ? undefined
      : data.FaceDetails.map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        Face: x,
      }));
  }

  mapUniqueNameToSequenceFile(mapData, data, seqFile) {
    let keys = data.map(x =>
      ((x.Face || {}).Gender || {}).Value).filter(x => x);
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

module.exports = DetectFaceIterator;
