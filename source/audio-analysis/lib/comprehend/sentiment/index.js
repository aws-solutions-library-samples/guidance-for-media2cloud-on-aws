/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const {
  AnalysisError,
} = require('m2c-core-lib');

const {
  BaseComprehend,
} = require('../base');

const {
  Parser,
} = require('../../transcribe/parser');

/**
 * @class ParserX
 * @description extends Parser class for sentiment specific logics
 */
class ParserX extends Parser {
  offsetToBeginTime(offset) {
    while (this.current) {
      if (Math.abs(offset - this.begin) <= 1) {
        return this.current.start_time;
      }

      this.begin += this.current.alternatives[0].content.length;
      if (this.current.type !== 'punctuation') {
        this.begin += 1;
      }

      this.current = this.getNext();
      if (!this.current) {
        break;
      }
      this.end = this.begin + this.current.alternatives[0].content.length;
    }
    throw new AnalysisError(`failed to find begin time with offset = ${offset}`);
  }

  offsetToEndTime(offset) {
    while (this.current) {
      if (Math.abs(offset - this.end) <= 1) {
        return this.current.end_time;
      }

      this.begin += this.current.alternatives[0].content.length;
      if (this.current.type !== 'punctuation') {
        this.begin += 1;
      }

      this.current = this.getNext();
      if (!this.current) {
        break;
      }
      this.end = this.begin + this.current.alternatives[0].content.length;
    }
    throw new AnalysisError(`failed to find end time with offset = ${offset}`);
  }
}

/**
 * @class Sentiment
 */
class Sentiment extends BaseComprehend {
  constructor(stateData) {
    super('sentiment', stateData);
  }

  get [Symbol.toStringTag]() {
    return 'Sentiment';
  }

  /**
   * @override
   * @function startJob
   * @description override to bind to comprehend.batchDetectSentiment
   */
  async startJob() {
    const fn = this.instance.batchDetectSentiment.bind(this.instance);
    return super.startJob(fn);
  }

  /**
   * @async
   * @function createTrack
   * @description create timeline track by converting Offsets into timecodes
   */
  async createTrack(...args) {
    const [
      transcript,
      output,
    ] = await this.downloadResults();

    const collection = [];

    const parser = new ParserX(transcript);
    let item;
    while ((output.Sentiments || []).length) {
      item = output.Sentiments.shift();

      const begin = parser.offsetToBeginTime(item.BeginOffset);
      const end = parser.offsetToEndTime(item.EndOffset);

      /* eslint-disable no-loop-func */
      const scores = Object.keys(item.SentimentScore).reduce((acc, cur) =>
        Object.assign(acc, {
          [cur.toUpperCase()]: item.SentimentScore[cur],
        }), {});
      /* eslint-enable no-loop-func */

      collection.push({
        text: item.Sentiment,
        confidence: Number.parseFloat(Number(scores[item.Sentiment] * 100).toFixed(2)),
        begin: Number.parseInt(begin * 1000, 10),
        end: Number.parseInt(end * 1000, 10),
      });
    }

    const key = await this.uploadMetadataResults(collection);

    return this.setTrackSucceeded(key);
  }

  /**
   * @override
   * @function mergeBatchResults
   * @description override to insert Offsets to the payload
   */
  mergeBatchResults(parts, results) {
    const merged = [];

    let idx = 0;
    while (results.length) {
      const slices = results.splice(0, BaseComprehend.Constants.SlicesPerProcess);
      while (slices.length) {
        const slice = slices.shift();
        slice.Index += (idx * BaseComprehend.Constants.SlicesPerProcess);
        slice.BeginOffset = parts[slice.Index].begin;
        slice.EndOffset = parts[slice.Index].end;
        merged.push(slice);
      }
      idx += 1;
    }

    return {
      Sentiments: merged,
    };
  }
}

module.exports = {
  Sentiment,
};
