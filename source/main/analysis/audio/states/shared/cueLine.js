/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const THRESHOLD_LINECHARACTERS = 68; // at most 68 characters
const THRESHOLD_LINEDURATION = 4000; // 4 seconds
const THRESHOLD_LONGPAUSE = 1200; // long pause detection
const THRESHOLD_BYTELENGTH = 4900; // 4900 bytes

class CueItem {
  constructor(item) {
    if (item) {
      this.$begin = item.begin;
      this.$end = item.end;
      this.$type = item.type;
      this.$content = item.content;
      this.$confidence = item.confidence;
      this.$cueText = CueItem.addCssClass(item.content, item.confidence);
      this.$beginOffset = item.beginOffset;
    }
  }

  static createFromTranscript(item) {
    if (!item) {
      throw new Error('item is null');
    }

    const begin = (item.start_time !== undefined)
      ? Number.parseInt(Number.parseFloat(item.start_time) * 1000, 10)
      : undefined;
    const end = (item.end_time !== undefined)
      ? Number.parseInt(Number.parseFloat(item.end_time) * 1000, 10)
      : undefined;
    const type = item.type;
    const alts = item.alternatives.map(x => ({
      content: x.content,
      confidence: Number.parseFloat(Number(x.confidence * 100).toFixed(2)),
    })).sort((a, b) => b.confidence - a.confidence);
    const content = alts[0].content;
    const confidence = alts[0].confidence;

    return new CueItem({
      begin,
      end,
      type,
      content,
      confidence,
    });
  }

  static testPunctuation(item = {}) {
    return item.type === 'punctuation';
  }

  static addCssClass(text, confidence) {
    let textClass = 'unsure';
    if (confidence > 50.0) {
      textClass = 'five';
    }
    if (confidence > 60.0) {
      textClass = 'six';
    }
    if (confidence > 70.0) {
      textClass = 'seven';
    }
    if (confidence > 80.0) {
      textClass = 'eigth';
    }
    return (confidence > 90.0) ? `${text}` : `<c.${textClass}>${text}</c>`;
  }

  get [Symbol.toStringTag]() {
    return 'CueItem';
  }

  canUse() {
    return this.content.length > 0;
  }

  get lineCharacterThreshold() {
    return THRESHOLD_LINECHARACTERS;
  }

  get lineDurationThreshold() {
    return THRESHOLD_LINEDURATION;
  }

  get longPauseThreshold() {
    return THRESHOLD_LONGPAUSE;
  }

  get byteLengthThreshold() {
    return THRESHOLD_BYTELENGTH;
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

  get type() {
    return this.$type;
  }

  set type(val) {
    this.$type = val;
  }

  get content() {
    return this.$content;
  }

  set content(val) {
    this.$content = val;
  }

  get confidence() {
    return this.$confidence;
  }

  set confidence(val) {
    this.$confidence = val;
  }

  isPunctuation() {
    return this.type === 'punctuation';
  }

  get cueText() {
    return this.$cueText;
  }

  set cueText(val) {
    this.$cueText = val;
  }

  get beginOffset() {
    return this.$beginOffset;
  }

  set beginOffset(val) {
    this.$beginOffset = val;
  }

  get endOffset() {
    return (this.beginOffset === undefined)
      ? undefined
      : this.beginOffset + this.content.length;
  }

  beginOffsetWithinRange(x) {
    return x >= this.beginOffset && x < this.endOffset;
  }

  beginOffsetOutOfRange(x) {
    return this.beginOffset > x;
  }

  endOffsetWithinRange(x) {
    return x > this.beginOffset && x <= this.endOffset;
  }

  endOffsetOutOfRange(x) {
    return this.endOffset > x;
  }

  toJSON() {
    return {
      type: this.type,
      content: this.content,
      confidence: this.confidence,
      begin: this.begin,
      end: this.end,
      beginOffset: this.beginOffset,
      // length: this.content.length,
      // byteLength: Buffer.byteLength(this.content),
    };
  }
}

class CueLineQ extends Array {
  constructor(...args) {
    super(...args);
    this.$totalCharacterLength = 0;
    this.$totalByteLength = 0;
    this.$wordCounts = 0;
  }

  get totalCharacterLength() {
    return this.$totalCharacterLength;
  }

  set totalCharacterLength(val) {
    this.$totalCharacterLength = val;
  }

  get totalByteLength() {
    return this.$totalByteLength;
  }

  set totalByteLength(val) {
    this.$totalByteLength = val;
  }

  get wordCounts() {
    return this.$wordCounts;
  }

  set wordCounts(val) {
    this.$wordCounts = val;
  }

  get first() {
    return this[0];
  }

  get last() {
    return this[this.length - 1];
  }

  toJSON() {
    const cueItems = [];
    for (let i = 0; i < this.length; i++) {
      cueItems.push(this[i].toJSON());
    }
    return {
      totalCharacterLength: this.totalCharacterLength,
      totalByteLength: this.totalByteLength,
      wordCounts: this.wordCounts,
      cueItems,
    };
  }

  lineCharacterExceedThreshold(item) {
    if (!this.length || !item) {
      return false;
    }
    return (this.totalCharacterLength + item.content.length) > item.lineCharacterThreshold;
  }

  lineDurationExceedThreshold(item) {
    if (!this.length || !item) {
      return false;
    }
    return (Math.abs(item.end - this.first.begin) > item.lineDurationThreshold);
  }

  longPauseExceedThreshold(item) {
    if (!this.length || !item) {
      return false;
    }
    return (Math.abs(item.begin - this.last.end) > item.longPauseThreshold);
  }

  byteLengthExceedThreshold(item) {
    if (!this.length || !item) {
      return false;
    }
    return (this.totalByteLength + Buffer.byteLength(item.content)) > item.byteLengthThreshold;
  }

  increment(item) {
    if (item) {
      this.totalCharacterLength += item.content.length;
      this.totalByteLength += Buffer.byteLength(item.content);
      if (item.type !== 'punctuation') {
        this.totalCharacterLength += 1;
        this.totalByteLength += 1;
        this.wordCounts += 1;
      }
    }
    return item;
  }

  decrement(item) {
    if (item) {
      this.totalCharacterLength -= item.content.length;
      this.totalByteLength -= Buffer.byteLength(item.content);
      if (item.type !== 'punctuation') {
        this.totalCharacterLength -= 1;
        this.totalByteLength -= 1;
        this.wordCounts -= 1;
      }
    }
    return item;
  }

  pop() {
    return this.decrement(this.shift());
  }

  push(item) {
    return super.push(this.increment(item));
  }

  insert(pos, item) {
    return super.splice(pos, 0, this.increment(item));
  }

  empty() {
    this.length = 0;
    this.totalByteLength = 0;
    this.totalCharacterLength = 0;
    this.wordCounts = 0;
  }

  /**
   * @function reduceAll
   * @description reduce queue into a single CueItem object by
   * computing geometric mean of object's properties
   * @returns {CueItem} a CueItem object as a result of combining the queue items
   */
  reduceAll(autoRemove = true) {
    if (!this.length) {
      return undefined;
    }

    let item;
    let content = '';
    let cueText = '';
    const first = new CueItem(this.first);
    for (let i = 0; i < this.length; i++) {
      item = this[i];
      if (Number.isNaN(first.begin)) {
        first.begin = item.begin;
      }
      if (item.isPunctuation()) {
        content += item.content;
        cueText += item.cueText;
      } else {
        content += ` ${item.content}`;
        cueText += ` ${item.cueText}`;
        first.end = item.end;
      }
    }
    first.content = content;
    first.cueText = cueText;
    first.type = 'phrase';

    if (autoRemove) {
      this.empty();
    }
    return first;
  }

  embedCharacterOffsets() {
    let item;
    let offset = 0;
    for (let i = 0; i < this.length; i++) {
      item = this[i];
      item.beginOffset = (item.isPunctuation()) ? offset : offset + 1;
      offset = item.endOffset;
    }
  }

  static createFromJson(data) {
    const queue = new CueLineQ();
    while (data.cueItems.length) {
      queue.push(new CueItem(data.cueItems.shift()));
    }
    if (queue.totalByteLength !== data.totalByteLength
      || queue.totalCharacterLength !== data.totalCharacterLength
      || queue.wordCounts !== data.wordCounts) {
      throw new Error('mismatched dataset');
    }
    return queue;
  }
}

module.exports = {
  CueItem,
  CueLineQ,
};
