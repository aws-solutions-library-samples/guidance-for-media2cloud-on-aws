// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  AnalysisTypes,
  AnalysisError,
  NodeWebVtt,
} = require('core-lib');
const BaseStateIndexer = require('../shared/baseStateIndexer');

const SUB_CATEGORY = AnalysisTypes.Transcribe;
class StateIndexTranscribeResults extends BaseStateIndexer {
  constructor(stateData) {
    super(stateData, SUB_CATEGORY);
  }

  get [Symbol.toStringTag]() {
    return 'StateIndexTranscribeResults';
  }

  get dataKey() {
    return this.stateData.data[SUB_CATEGORY].vtt;
  }

  parseDataset(datasets) {
    if (!datasets) {
      return undefined;
    }
    const vtt = this.parseWebVtt(datasets);
    if (vtt.cues.length === 0) {
      return undefined;
    }
    const phrases = [];
    while (vtt.cues.length) {
      const cue = vtt.cues.shift();
      while (cue.text.length) {
        const name = cue.text.shift();
        phrases.push({
          name,
          timecodes: [
            {
              begin: cue.begin,
              end: cue.end,
            },
          ],
        });
      }
    }
    return phrases;
  }

  parseWebVtt(vtt) {
    const parsed = NodeWebVtt.parse(vtt);
    if (!parsed.valid) {
      throw new AnalysisError('failed to parse vtt');
    }
    parsed.cues = parsed.cues.map((cue) => {
      const lines = cue.text.split('\n').map((x) => {
        const matched = x.match(/^--\s(.*)/);
        return (matched)
          ? matched[1].trim()
          : x.trim();
      }).filter((x) =>
        x && x.length > 0);
      return (lines.length > 0)
        ? {
          id: Number(cue.identifier),
          begin: Math.round(cue.start * 1000),
          end: Math.round(cue.end * 1000),
          text: lines,
        }
        : undefined;
    }).filter((x) =>
      x !== undefined);
    return parsed;
  }
}

module.exports = StateIndexTranscribeResults;
