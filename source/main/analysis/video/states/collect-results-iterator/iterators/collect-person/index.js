// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  GetPersonTrackingCommand,
} = require('@aws-sdk/client-rekognition');
const {
  AnalysisTypes,
} = require('core-lib');
const BaseCollectResultsIterator = require('../shared/baseCollectResultsIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Person;
const NAMED_KEY = 'Persons';

class CollectPersonIterator extends BaseCollectResultsIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY, NAMED_KEY);
    this.$paramOptions = {
      SortBy: 'TIMESTAMP',
    };
  }

  get [Symbol.toStringTag]() {
    return 'CollectPersonIterator';
  }

  getRunCommand(params) {
    return new GetPersonTrackingCommand(params);
  }

  parseResults(dataset) {
    return dataset[NAMED_KEY];
  }

  getUniqueNames(dataset) {
    return [
      ...new Set(dataset
        .map((x) =>
          String(x.Person.Index))),
    ];
  }
}

module.exports = CollectPersonIterator;
