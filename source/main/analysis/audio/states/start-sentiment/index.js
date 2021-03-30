/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const SUB_CATEGORY = 'sentiment';

class StateStartSentiment extends BaseStateStartComprehend {
  constructor(stateData) {
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
    });
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: comprehend.batchDetectSentiment.bind(comprehend),
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartSentiment';
  }

  parseJobResults(responses) {
    return responses.map(x => x.ResultList);
  }
}

module.exports = StateStartSentiment;
