/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const BaseStateCreateTrack = require('../shared/baseStateCreateTrack');

const SUB_CATEGORY = 'keyphrase';

class StateCreateKeyphraseTrack extends BaseStateCreateTrack {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateCreateKeyphraseTrack';
  }
}

module.exports = StateCreateKeyphraseTrack;
