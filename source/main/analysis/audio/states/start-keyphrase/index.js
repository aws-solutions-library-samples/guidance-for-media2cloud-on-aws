// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ComprehendClient,
  BatchDetectKeyPhrasesCommand,
} = require('@aws-sdk/client-comprehend');
const {
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
} = require('core-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const SUB_CATEGORY = 'keyphrase';
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class StateStartKeyphrase extends BaseStateStartComprehend {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartKeyphrase';
  }

  async startDetection(params) {
    const command = new BatchDetectKeyPhrasesCommand(params);
    return BaseStateStartComprehend.RunCommand(command);
  }

  parseJobResults(results, reference) {
    if (!((results || {}).ResultList || []).length) {
      return undefined;
    }
    const parsed = [];
    while (results.ResultList.length) {
      const result = results.ResultList.shift();
      while (result.KeyPhrases.length) {
        const keyphrase = result.KeyPhrases.shift();
        const timecode = reference[result.Index].timecodes[0];
        parsed.push({
          text: keyphrase.Text,
          confidence: Number(Number(keyphrase.Score * 100).toFixed(2)),
          begin: timecode.begin,
          end: timecode.end,
        });
      }
    }
    return parsed;
  }
}

module.exports = StateStartKeyphrase;
