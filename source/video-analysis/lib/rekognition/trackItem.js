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

/**
 * @class TrackItem
 */
class TrackItem {
  constructor(keyword, item = {}) {
    this.$keyword = keyword;
    this.$begin = item.Timestamp;
    this.$end = item.Timestamp;
    this.$confidence = item[keyword].Confidence;
    // const box = (item[keyword].Face || {}).BoundingBox || item[keyword].BoundingBox || {};
    const box = item[keyword].BoundingBox || {};
    this.$x = box.Left;
    this.$y = box.Top;
    this.$w = box.Width;
    this.$h = box.Height;
    this.$count = 1;
  }

  static get Constants() {
    return {
      TimeDrift: 400,
      PositionDrift: 0.05,
    };
  }

  get [Symbol.toStringTag]() {
    return 'TrackItem';
  }

  get keyword() {
    return this.$keyword;
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

  get x() {
    return this.$x;
  }

  set x(val) {
    this.$x = val;
  }

  get y() {
    return this.$y;
  }

  set y(val) {
    this.$y = val;
  }

  get w() {
    return this.$w;
  }

  set w(val) {
    this.$w = val;
  }

  get h() {
    return this.$h;
  }

  set h(val) {
    this.$h = val;
  }

  get count() {
    return this.$count;
  }

  set count(val) {
    this.$count = val;
  }

  hasBoundingBox() {
    return (this.x && this.y && this.w && this.h);
  }

  combineItem(next) {
    this.end = next.begin;
    this.averageConfidence(next.confidence);
  }

  averageConfidence(confidence) {
    if (confidence) {
      this.confidence = ((this.confidence * this.count) + confidence) / (this.count + 1);
      this.count += 1;
    }
  }

  timeDrift(timestamp) {
    return ((timestamp - this.end) >= TrackItem.Constants.TimeDrift);
  }

  positionDrift(next) {
    /* if both don't have coord, no drift */
    if (!this.x && !next.x) {
      return false;
    }
    /* if only one of them has coord, drift */
    if ((!this.x && next.x) || (this.x && !next.x)) {
      return true;
    }
    const x = Math.abs((this.x + (this.w / 2)) - (next.x + (next.w / 2)));
    const y = Math.abs((this.y + (this.h / 2)) - (next.y + (next.h / 2)));
    return (Math.sqrt((x * x) + (y * y)) > TrackItem.Constants.PositionDrift);
  }
}

/**
 * @class LabelItem
 * @description override TrackItem to implement Parents field
 */
class LabelItem extends TrackItem {
  constructor(keyword, item = {}) {
    super(keyword, item);
    this.$parents = ((item[keyword] || {}).Parents || []).map(x => x.Name);
  }

  get parents() {
    return this.$parents;
  }
}

/**
 * @class FaceMatchItem
 * @description override TrackItem as FaceMatch uses 'Similarity' instead of 'Confidence'
 */
class FaceMatchItem extends TrackItem {
  constructor(keyword, item = {}) {
    super(keyword, item);
    this.$confidence = item.Similarity;
  }
}

class ModerationItem extends TrackItem {
  constructor(keyword, item = {}) {
    super(keyword, item);
    this.$child = (item[keyword] || {}).Name;
  }

  get child() {
    return this.$child;
  }
}

module.exports = {
  TrackItem,
  LabelItem,
  FaceMatchItem,
  ModerationItem,
};
