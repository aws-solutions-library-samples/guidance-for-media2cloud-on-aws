// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

class WebVttCue {
  constructor(begin, end, text, position, factor = 1) {
    // make sure end time > start time
    let _end = end;
    if (end - begin <= 0) {
      _end = Math.round(begin + (0.1 * factor));
    }
    this.$begin = begin;
    this.$end = _end;
    this.$position = (position) ? ` ${position}` : '';
    this.$text = text;
    this.$factor = factor;
  }

  get [Symbol.toStringTag]() {
    return 'WebVttCue';
  }

  get begin() {
    return this.$begin;
  }

  get end() {
    return this.$end;
  }

  get position() {
    return this.$position;
  }

  set position(val = '') {
    this.$position = (val[0] === ' ')
      ? val
      : ` ${val}`;
  }

  get text() {
    return this.$text;
  }

  set text(val) {
    this.$text = val;
  }

  get factor() {
    return this.$factor;
  }

  toTimeString(offset) {
    const offsetMillis = offset * this.factor;
    const HH = Math.floor(offsetMillis / 3600000);
    const MM = Math.floor((offsetMillis % 3600000) / 60000);
    const SS = Math.floor((offsetMillis % 60000) / 1000);
    const mmm = Math.ceil(offsetMillis % 1000);

    return `${HH.toString().padStart(2, '0')}:${MM.toString().padStart(2, '0')}:${SS.toString().padStart(2, '0')}.${mmm.toString().padStart(3, '0')}`;
  }

  toString() {
    return `${this.toTimeString(this.begin)} --> ${this.toTimeString(this.end)}${this.position}\n${this.text}`;
  }
}

module.exports = WebVttCue;
