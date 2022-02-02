// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const WebVttCue = require('./webVttCue');

class WebVttTrack {
  constructor(unit = WebVttTrack.Constants.UnitInMilliseconds) {
    this.$factor = unit;
    this.$cues = [];
  }

  static get Constants() {
    return {
      UnitInMilliseconds: 1,
      UnitInSeconds: 1000,
      Timecode: {
        Regex: /^([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{2,})\s+-->\s+([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{2,})(.*)$/,
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'WebVttTrack';
  }

  get factor() {
    return this.$factor;
  }

  get cues() {
    return this.$cues;
  }

  get length() {
    return this.cues.length;
  }

  set length(val) {
    this.cues.length = val;
  }

  shift() {
    return this.cues.shift();
  }

  push(cue) {
    if (cue instanceof WebVttCue) {
      this.cues.push(cue);
    }
  }

  pop() {
    return this.cues.pop();
  }

  addCue(begin, end, text, position) {
    this.cues.push(new WebVttCue(begin, end, text, position, this.factor));
  }

  toString() {
    let webvtt = 'WEBVTT\n\n';
    this.cues.forEach((cue, idx) => {
      webvtt += `${idx}\n${cue.toString()}\n\n`;
    });
    return webvtt;
  }

  /**
   * @static
   * @function convertToMilliseconds
   * @description convert array to milliseconds
   * @param {Array} array
   */
  static convertToMilliseconds(array) {
    return ((Number.parseInt(array[0], 10) * 3600) +
      (Number.parseInt(array[1], 10) * 60) +
      (Number.parseInt(array[2], 10))) * 1000 +
      (Number.parseInt(array[3], 10));
  }

  /**
   * @static
   * @functiom parse
   * @descriptiomn parse webvtt file into WebVttTrack object
   * @param {string} body
   * @returns WebVttTrack
   */
  static parse(body) {
    const vttTrack = new WebVttTrack();

    const lines = body.split('\n');
    lines.shift(); // WEBVTT
    while (lines.length) {
      let line = lines.shift();

      /* look for index */
      if (!/[0-9]+/.test(line)) {
        continue;
      }

      const matched = lines.shift().match(WebVttTrack.Constants.Timecode.Regex);
      matched.shift();

      const begin = WebVttTrack.convertToMilliseconds(matched.splice(0, 4));
      const end = WebVttTrack.convertToMilliseconds(matched.splice(0, 4));
      const position = matched.shift().trim();
      const text = [];
      do {
        line = lines.shift();
        if (line.length) {
          text.push(line);
        }
      } while (line.length);
      vttTrack.addCue(begin, end, text.join('\n'), position);
    }

    return vttTrack;
  }
}

module.exports = WebVttTrack;
