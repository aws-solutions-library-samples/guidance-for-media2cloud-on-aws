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

/**
 * @class Parser
 */
class Parser {
  constructor(transcript) {
    if (!(transcript || {}).items) {
      throw new AnalysisError('missing transcript.items');
    }

    this.$items = transcript.items;
    this.$current = transcript.items.shift();
    this.$begin = 0;
    this.$end = this.$current.alternatives[0].content.length;
  }

  get [Symbol.toStringTag]() {
    return 'Parser';
  }

  get begin() {
    return this.$begin;
  }

  set begin(val) {
    this.$begin = val;
  }

  get end() {
    return this.$end;
  }

  set end(val) {
    this.$end = val;
  }

  get current() {
    return this.$current;
  }

  set current(val) {
    this.$current = val;
  }

  get items() {
    return this.$items;
  }

  getNext() {
    return this.items.shift();
  }

  offsetToBeginTime(offset) {
    while (this.current) {
      if (offset >= this.begin && offset < this.end) {
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
      if (offset >= this.begin && offset <= this.end) {
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

module.exports = {
  Parser,
};
