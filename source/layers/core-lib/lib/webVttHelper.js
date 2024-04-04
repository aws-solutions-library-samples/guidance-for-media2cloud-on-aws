// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const NodeWebVtt = require('node-webvtt');
const CommonUtils = require('./commonUtils');

class WebVttHelper {
  static async download(
    bucket,
    key,
    options
  ) {
    return CommonUtils.download(
      bucket,
      key
    ).then((res) =>
      WebVttHelper.parse(res, options));
  }

  static parse(vtt, options = {}) {
    const parsed = NodeWebVtt.parse(
      vtt,
      {
        meta: true,
        strict: false,
      }
    );

    if (!parsed.valid) {
      console.log(
        'ERR:',
        'WebVttHelper.parse:',
        `${parsed.errors.length} invalid VTT cues`,
        parsed.errors
          .map((x) =>
            x.message)
          .join('; ')
      );
    }

    if (!parsed.cues.length) {
      return parsed;
    }

    const {
      autoCorrect = false,
      stripLeadingDashes = false,
    } = options;

    /* workaround potential invalid timestamps from Amazon Transcribe */
    if (autoCorrect) {
      const cues = [];

      cues.push(parsed.cues.shift());
      while (parsed.cues.length) {
        const prev = cues[cues.length - 1];
        const cue = parsed.cues.shift();
        if (cue.start > 0 && cue.end > 0 && (cue.end - cue.start) > 0
        && (cue.start - prev.end) > 0) {
          cues.push(cue);
        }
      }

      if (cues.length !== parsed.cues.length) {
        parsed.cues = cues
          .map((cue, idx) => ({
            ...cue,
            identifier: String(idx),
          }));
      }
    }

    if (stripLeadingDashes) {
      parsed.cues = parsed.cues
        .map((cue) => {
          const lines = cue.text.split('\n')
            .map((x) => {
              const matched = x.match(/^--\s(.*)/);
              if (matched) {
                return matched[1].trim();
              }
              return x.trim();
            })
            .filter((x) =>
              x && x.length > 0);

          if (lines.length > 0) {
            return {
              ...cue,
              text: lines.join('\n'),
            };
          }
          return undefined;
        })
        .filter((x) =>
          x !== undefined);
    }

    return parsed;
  }

  static compile(vtt) {
    return NodeWebVtt.compile(vtt);
  }

  static cuesToMetadata(cues = []) {
    const dataset = [];

    cues.forEach((cue) => {
      const begin = Math.round(cue.start * 1000);
      const end = Math.round(cue.end * 1000);

      const texts = cue.text.split('\n');
      texts.forEach((text) => {
        dataset.push({
          name: text,
          timecodes: [
            {
              begin,
              end,
            },
          ],
        });
      });
    });

    return dataset;
  }
}

module.exports = WebVttHelper;
