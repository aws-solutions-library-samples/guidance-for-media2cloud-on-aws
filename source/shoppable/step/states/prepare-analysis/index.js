// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
  AnalysisTypes: {
    Shoppable,
  },
  CommonUtils,
} = require('core-lib');
const {
  FeatureNotEnabledException,
} = require('../shared/exceptions');
const BaseState = require('../shared/baseState');

const JSON_SHOPPABLE_EMBEDDINGS = 'shoppable_embeddings.json';

class StatePrepareAnalysis extends BaseState {
  static canHandle(op) {
    return op === 'StatePrepareAnalysis';
  }

  async process() {
    const {
      input: {
        aiOptions = {},
        destination: {
          bucket: proxyBucket,
        },
      },
      data: {
        framesegmentation: {
          key: frameJsonKey,
        },
      },
    } = this.event;

    if (aiOptions[Shoppable] !== true) {
      throw new FeatureNotEnabledException('Shoppable feature not enabled');
    }

    // prepare payload for model to run
    const parsed = PATH.parse(frameJsonKey);
    const framePrefix = parsed.dir;
    const json = parsed.base;
    const frames = await CommonUtils.download(
      proxyBucket,
      frameJsonKey
    ).then((res) =>
      JSON.parse(res));

    const names = frames
      .map((frame) =>
        frame.name);
    this.event.data.shoppable = {
      bucket: proxyBucket,
      prefix: framePrefix,
      json,
      embeddings: JSON_SHOPPABLE_EMBEDDINGS,
    };

    return this.event;
  }
}

module.exports = StatePrepareAnalysis;
