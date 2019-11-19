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
  TrackItem,
} = require('./trackItem');

/**
 * @class TimelineItem
 */
class TimelineItem {
  constructor(item) {
    if (!(item instanceof TrackItem)) {
      throw new AnalysisError('item must be TrackItem');
    }

    this.$begin = item.begin;
    this.$end = item.end;
    this.$confidence = item.confidence;
    this.$count = item.count;
  }

  static get Constants() {
    return {
      TimelineDrift: 1100,
    };
  }

  get [Symbol.toStringTag]() {
    return 'TimelineItem';
  }

  get confidence() {
    return this.$confidence;
  }

  set confidence(val) {
    this.$confidence = val;
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

  get count() {
    return this.$count;
  }

  set count(val) {
    this.$count = val;
  }

  toJSON() {
    return {
      begin: this.begin,
      end: this.end,
      confidence: Number.parseFloat(this.confidence),
      count: this.count,
    };
  }

  combineItem(next) {
    this.averageConfidence(next.confidence);
    this.end = next.end;
  }

  averageConfidence(confidence) {
    if (confidence) {
      this.confidence = ((this.confidence * this.count) + confidence) / (this.count + 1);
      this.count += 1;
    }
  }

  timelineDrift(timestamp) {
    return ((timestamp - this.end) >= TrackItem.Constants.TimelineDrift);
  }
}

module.exports = {
  TimelineItem,
};
