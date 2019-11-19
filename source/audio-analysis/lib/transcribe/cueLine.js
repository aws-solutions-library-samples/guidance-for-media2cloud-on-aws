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
 * @class CueLine
 */
class CueLine {
  constructor() {
    this.$begin = undefined;
    this.$end = undefined;
    this.$cueText = '';
    this.$plainText = '';
    this.$lastItem = undefined;
    this.$endOfSentence = false;
  }

  static get Constants() {
    return {
      CharacterThreshold: 68,
      BreakPerSeconds: 4.0,
      PauseThreshould: 1.2,
    };
  }

  get begin() {
    return this.$begin;
  }

  set begin(val) {
    this.$begin = Number.parseFloat(val);
  }

  get end() {
    return this.$end;
  }

  set end(val) {
    this.$end = Number.parseFloat(val);
  }

  get cueText() {
    return this.$cueText;
  }

  set cueText(val) {
    this.$cueText = val;
  }

  get plainText() {
    return this.$plainText;
  }

  set plainText(val) {
    this.$plainText = val;
  }

  get lastItem() {
    return this.$lastItem;
  }

  set lastItem(val) {
    this.$lastItem = Object.assign({}, val);
  }

  get endOfSentence() {
    return this.$endOfSentence;
  }

  set endOfSentence(val) {
    this.$endOfSentence = !!val;
  }

  shouldBreak() {
    if (this.plainText.length >= CueLine.Constants.CharacterThreshold) {
      return true;
    }

    if (this.endOfSentence && (this.end - this.begin) > CueLine.Constants.BreakPerSeconds) {
      return true;
    }

    return false;
  }

  addClass(text, confidence) {
    const level = Number.parseFloat(confidence);
    let textClass = 'unsure';
    if (level > 0.5) {
      textClass = 'five';
    }
    if (level > 0.6) {
      textClass = 'six';
    }
    if (level > 0.7) {
      textClass = 'seven';
    }
    if (level > 0.8) {
      textClass = 'eigth';
    }
    return (level > 0.9)
      ? `${text}`
      : `<c.${textClass}>${text}</c>`;
  }

  addItem(item) {
    if ((this.end !== undefined)
      && (item.start_time - this.end) > CueLine.Constants.PauseThreshould) {
      return false;
    }

    if (this.addPunctuation(item)) {
      this.endOfSentence = (item.alternatives[0].content !== ',');
    } else {
      this.plainText += ` ${item.alternatives[0].content}`;
      this.cueText += ` ${this.addClass(item.alternatives[0].content, item.alternatives[0].confidence)}`;
      this.begin = this.begin || item.start_time;
      this.end = item.end_time;
      this.endOfSentence = false;
    }

    this.lastItem = item;
    return true;
  }

  addPunctuation(item) {
    if (item.type !== 'punctuation') {
      return false;
    }
    this.plainText += item.alternatives[0].content;
    this.cueText += item.alternatives[0].content;
    return true;
  }
}


module.exports = {
  CueLine,
};
