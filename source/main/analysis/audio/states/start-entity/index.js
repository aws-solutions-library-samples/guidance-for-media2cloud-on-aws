// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  Environment,
} = require('core-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const SUB_CATEGORY = 'entity';

class StateStartEntity extends BaseStateStartComprehend {
  constructor(stateData) {
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: comprehend.batchDetectEntities.bind(comprehend),
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartEntity';
  }

  parseJobResults(results, reference) {
    if (!((results || {}).ResultList || []).length) {
      return undefined;
    }
    const parsed = [];
    while (results.ResultList.length) {
      const result = results.ResultList.shift();
      while (result.Entities.length) {
        const entity = result.Entities.shift();
        const timecode = reference[result.Index].timecodes[0];
        parsed.push({
          type: entity.Type,
          text: entity.Text,
          confidence: Number(Number(entity.Score * 100).toFixed(2)),
          begin: timecode.begin,
          end: timecode.end,
        });
      }
    }
    return parsed;
  }
}

module.exports = StateStartEntity;
