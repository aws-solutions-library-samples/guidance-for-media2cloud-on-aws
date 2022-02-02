// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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

const SUB_CATEGORY = 'sentiment';
const ONE_MINUTE_MSEC = 1 * 60 * 1000;
const DOCUMENTS_PER_BATCH = 25;

class StateStartSentiment extends BaseStateStartComprehend {
  constructor(stateData) {
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: comprehend.batchDetectSentiment.bind(comprehend),
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartSentiment';
  }

  prepareDocuments(datasets) {
    /* analyze sentiment based on 1-min sample */
    const documents = [];
    if (!datasets.length) {
      return documents;
    }
    const stack = [];
    while (datasets.length) {
      const data = datasets.shift();
      if (!stack.length) {
        stack.push(data);
        continue;
      }
      const tsta = stack[0].timecodes[0].begin;
      const tend = tsta + ONE_MINUTE_MSEC;
      if (data.timecodes[0].end <= tend) {
        stack.push(data);
        continue;
      }
      datasets.unshift(data);
      documents.push(this.mergeTextFragments(stack));
      stack.length = 0;
      if (documents.length === DOCUMENTS_PER_BATCH) {
        return documents;
      }
    }
    /* process leftover stack */
    if (stack.length > 0) {
      documents.push(this.mergeTextFragments(stack));
    }
    return documents;
  }

  mergeTextFragments(stack) {
    return {
      name: stack.map((x) =>
        x.name).join(' '),
      timecodes: [
        {
          begin: stack[0].timecodes[0].begin,
          end: stack[stack.length - 1].timecodes[0].end,
        },
      ],
    };
  }

  parseJobResults(results, reference) {
    if (!((results || {}).ResultList || []).length) {
      return undefined;
    }
    const parsed = [];
    while (results.ResultList.length) {
      const result = results.ResultList.shift();
      /* get the max sentiment score */
      const sentiment = Object.keys(result.SentimentScore).sort((a, b) =>
        result.SentimentScore[b] - result.SentimentScore[a]).shift();
      const timecode = reference[result.Index].timecodes[0];
      parsed.push({
        text: sentiment,
        confidence: Number(Number(result.SentimentScore[sentiment] * 100).toFixed(2)),
        begin: timecode.begin,
        end: timecode.end,
      });
    }
    return parsed;
  }
}

module.exports = StateStartSentiment;
