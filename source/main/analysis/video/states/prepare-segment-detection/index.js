// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  StateData,
  AnalysisError,
  AnalysisTypes: {
    Rekognition: {
      Segment,
    },
  },
  Environment: {
    Rekognition: {
      MinConfidence,
    },
  },
  CommonUtils,
} = require('core-lib');

const SEGMENTS_JSON = `${Segment}.json`;
const SEGMENTS_ZIP = `${Segment}.zip`;

class StatePrepareSegmentDetection {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StatePrepareSegmentDetection';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const {
      input: {
        destination: {
          bucket,
          prefix,
        },
        video: {
          key,
        },
        request: {
          timestamp: requestTime,
        },
        aiOptions: {
          minConfidence = MinConfidence,
          filters = {},
        },
        duration,
        framerate,
      },
    } = this.stateData;

    // clean up files from previous run...
    let promises = [];

    promises.push(PATH.join(prefix, 'metadata', Segment, SEGMENTS_JSON));
    promises.push(PATH.join(prefix, 'vtt', Segment, SEGMENTS_JSON));
    promises.push(PATH.join(prefix, 'edt', Segment, SEGMENTS_ZIP));

    promises = promises.map((_key) =>
      CommonUtils.deleteObject(bucket, _key)
        .catch(() =>
          undefined));
    await Promise.all(promises);

    let filterSettings;
    if (filters[Segment]) {
      filterSettings = filters[Segment];
    }

    this.stateData.data[Segment] = {
      bucket,
      prefix,
      key,
      duration,
      framerate,
      requestTime,
      minConfidence,
      cursor: 0,
      numOutputs: 0,
      filterSettings,
    };

    return this.stateData;
  }
}

module.exports = StatePrepareSegmentDetection;
