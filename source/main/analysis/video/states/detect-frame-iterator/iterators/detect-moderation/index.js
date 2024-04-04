// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DetectModerationLabelsCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseDetectFrameIterator = require('../shared/baseDetectFrameIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Moderation;
const NAMED_KEY = 'ModerationLabels';

class DetectModerationIterator extends BaseDetectFrameIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      MinConfidence: stateData.data[SUBCATEGORY].minConfidence,
    };
  }

  get [Symbol.toStringTag]() {
    return 'DetectModerationIterator';
  }

  async detectFrame(bucket, key, frameNo, timestamp) {
    const params = this.makeParams(bucket, key, this.paramOptions);
    const command = new DetectModerationLabelsCommand(params);

    return this.detectFn(command)
      .then((res) =>
        this.parseModerationResult(res, frameNo, timestamp));
  }

  parseModerationResult(data, frameNo, timestamp) {
    if (!data || !data.ModerationLabels || !data.ModerationLabels.length) {
      return undefined;
    }

    if (!this.modelMetadata) {
      this.modelMetadata = {
        ModerationModelVersion: data.ModerationModelVersion,
      };
    }

    const minConfidence = this.minConfidence;
    const filtered = data.ModerationLabels
      .filter((x) =>
        x.Confidence >= minConfidence);

    return filtered
      .map(x => ({
        Timestamp: timestamp,
        FrameNumber: frameNo,
        ModerationLabel: x,
      }));
  }

  getUniqueNames(dataset) {
    const unique = dataset
      .map((x) => ([
        x.ModerationLabel.ParentName,
        x.ModerationLabel.Name,
      ]))
      .flat(1)
      .filter((x) =>
        x);
    return [
      ...new Set(unique),
    ];
  }
}

module.exports = DetectModerationIterator;
