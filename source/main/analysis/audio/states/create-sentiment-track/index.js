/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  AnalysisError,
} = require('core-lib');
const {
  CueLineQ,
} = require('../shared/cueLine');
const BaseStateCreateTrack = require('../shared/baseStateCreateTrack');

const SUB_CATEGORY = 'sentiment';

class StateCreateSentimentTrack extends BaseStateCreateTrack {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateCreateSentimentTrack';
  }

  async process() {
    const cuelineQ = await this.downloadCuelineResult();
    let resultSets = await this.downloadDetectionResult();
    resultSets = [].concat(...resultSets);

    if (cuelineQ.length < resultSets.length) {
      throw new AnalysisError(`mismatch length of queues (${cuelineQ.length}) and results (${resultSets.length})`);
    }

    const processed = [];
    while (resultSets.length) {
      const result = resultSets.shift();
      const queue = CueLineQ.createFromJson(cuelineQ.shift());
      const item0 = queue.first;
      const item9 = queue.last;
      processed.push(this.convertMetadataOutput(result, item0.begin, item9.end));
    }

    const metadata = await this.uploadMetadataOutput(processed);
    return this.setTrackCompleted(metadata);
  }

  convertMetadataOutput(item, begin, end) {
    const key = Object.keys(item.SentimentScore).find(x =>
      x.toUpperCase() === item.Sentiment);
    return {
      text: item.Sentiment,
      confidence: Number.parseFloat(Number(item.SentimentScore[key] * 100).toFixed(2)),
      begin,
      end,
    };
  }
}

module.exports = StateCreateSentimentTrack;
