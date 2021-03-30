/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const SUB_CATEGORY = 'keyphrase';

class StateStartKeyphrase extends BaseStateStartComprehend {
  constructor(stateData) {
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
    });
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: comprehend.batchDetectKeyPhrases.bind(comprehend),
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartKeyphrase';
  }

  parseJobResults(responses) {
    return responses.reduce((a0, c0) =>
      a0.concat(c0.ResultList.map(x =>
        x.KeyPhrases)), []);
  }
}

module.exports = StateStartKeyphrase;
