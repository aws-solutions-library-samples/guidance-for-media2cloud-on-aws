// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  BatchDetectEntitiesCommand,
} = require('@aws-sdk/client-comprehend');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const SUB_CATEGORY = 'entity';

class StateStartEntity extends BaseStateStartComprehend {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartEntity';
  }

  async startDetection(params) {
    const command = new BatchDetectEntitiesCommand(params);
    return BaseStateStartComprehend.RunCommand(command);
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
