// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const PATH = require('node:path');
const {
  AnalysisTypes: {
    Transcribe,
    Scene,
  },
  CommonUtils,
  WebVttTrack,
  WebVttHelper,
} = require('core-lib');
const BaseState = require('../shared/base');

const REKOGNITION = 'rekognition';
const SPEECHES = 'speeches';
const CONVERSATIONS = 'conversations';
const DO_NOT_MERGE = [
  'ColorBars',
  'BlackFrames',
  'StudioLogo',
  'Slate',
  'EndCredits',
  // 'OpeningCredits',
  // 'Content',
  // 'undefined',
];

const FilterSettings = {
  enhanceWithTranscript: true,
};

class StateSceneEnhancement extends BaseState {
  constructor(event, context) {
    super(event, context);

    const {
      input: {
        aiOptions: {
          filters = {},
        },
      },
    } = this.stateData;
    _setFilterSettings(filters[Scene]);
  }

  static opSupported(op) {
    return op === 'StateSceneEnhancement';
  }

  async process() {
    const outputs = await this.downloadOutputs();

    if (outputs === undefined) {
      return this.stateData;
    }

    const {
      [SPEECHES]: speeches,
      [CONVERSATIONS]: conversations,
      [Scene]: {
        scene: scenes = [],
      },
    } = outputs;

    let merged = _mergeWithTranscript(scenes, speeches);

    merged = _mergeWithConversations(merged, conversations);

    outputs[Scene].scene = merged;

    // update webvtt track
    const track = new WebVttTrack();
    merged.forEach((scene, idx) => {
      scene.sceneNo = idx;

      // create vtt track
      const text = `Scene ${String(scene.sceneNo).padStart(3, '0')} (${_toHHMMSS(scene.duration)})`;
      const alignment = [
        'align:start',
        'line:0%',
        'position:0%',
        'size:40%',
      ].join(' ');

      track.addCue(
        scene.timeStart,
        scene.timeEnd,
        text,
        alignment
      );

      console.log(`[scene#${String(scene.sceneNo).padStart(3, '0')}]: ${String(scene.shotStart).padStart(4, ' ')} - ${String(scene.shotEnd).padStart(4, ' ')}, ${scene.smpteStart} -> ${scene.smpteEnd} (${_toHHMMSS(scene.duration, true)}) [${scene.technicalCueType}] FadeInOut = [${!!scene.fadeInBlack}, ${!!scene.fadeOutBlack}]`);
    });

    const {
      input: {
        destination: {
          bucket: proxyBucket,
        },
      },
      data: {
        video: {
          [REKOGNITION]: {
            [Scene]: {
              metadata: sceneMetadataKey,
              vtt: sceneVttKey,
            },
          },
        },
      },
    } = this.stateData;

    const promises = [];

    let parsed = PATH.parse(sceneMetadataKey);
    promises.push(CommonUtils.uploadFile(
      proxyBucket,
      parsed.dir,
      parsed.base,
      outputs[Scene]
    ));

    parsed = PATH.parse(sceneVttKey);
    promises.push(CommonUtils.uploadFile(
      proxyBucket,
      parsed.dir,
      parsed.base,
      {
        [Scene]: track.toString(),
      }
    ));

    return Promise.all(promises)
      .then(() =>
        this.stateData);
  }

  async downloadOutputs() {
    try {
      const {
        input: {
          destination: {
            bucket: proxyBucket,
          },
          aiOptions: {
            scene,
            transcribe,
          },
        },
        data: {
          audio: {
            [Transcribe]: {
              vtt: transcribeVtt,
              conversations,
            },
          },
          video: {
            [REKOGNITION]: {
              [Scene]: {
                metadata: sceneMetadata,
              },
            },
          },
        },
      } = this.stateData;

      const features = (scene && transcribe);
      if (!features) {
        throw new Error('scene detection not enabled');
      }

      let promises = [];

      // download transcribe
      promises.push(_downloadSpeeches(proxyBucket, transcribeVtt, SPEECHES));

      // download conversations
      let conversationsKey = conversations;
      if (conversationsKey === undefined) {
        conversationsKey = PATH.join(
          PATH.parse(transcribeVtt).dir,
          'conversations.json'
        );
      }
      promises.push(_downloadConversations(proxyBucket, conversationsKey, CONVERSATIONS));
      // download scenes
      promises.push(CommonUtils.download(proxyBucket, sceneMetadata)
        .then((res) => ({
          [Scene]: JSON.parse(res.toString()),
        })));

      promises = await Promise.all(promises);
      promises = promises.reduce((a0, c0) => ({
        ...a0,
        ...c0,
      }));

      return promises;
    } catch (e) {
      console.log(
        'WARN:',
        'downloadOutputs',
        e.message
      );

      return undefined;
    }
  }
}

function _mergeWithTranscript(scenes, speeches) {
  if (FilterSettings.enhanceWithTranscript === false) {
    return scenes;
  }

  if (speeches.length === 0 || scenes.length === 0) {
    return scenes;
  }

  const orig = scenes.length;
  console.log(`==== ORIGINAL: ${orig} scenes`);

  scenes.forEach((scene) => {
    console.log(`[scene#${String(scene.sceneNo).padStart(3, '0')}]: ${String(scene.shotStart).padStart(4, ' ')} - ${String(scene.shotEnd).padStart(4, ' ')}, ${scene.smpteStart} -> ${scene.smpteEnd} (${_toHHMMSS(scene.duration, true)}) [${scene.technicalCueType}]`);
  });

  let merged = [];
  let stack = [];

  while (scenes.length) {
    const scene = scenes.shift();

    if (DO_NOT_MERGE.includes(scene.technicalCueType)) {
      // empty stack
      if (stack.length > 0) {
        const _scenes = _mergeScenes(stack, speeches);
        merged = merged.concat(_scenes);
        stack = [];
      }
      merged.push(scene);
      continue;
    }

    stack.push(scene);
  }

  // empty the stack
  if (stack.length > 0) {
    const _scenes = _mergeScenes(stack, speeches);
    merged = merged.concat(_scenes);
    stack = [];
  }

  console.log(`==== MERGED: ${merged.length} scenes`);
  console.log(`Merge scenes with speech segments: ${orig} -> ${merged.length}`);

  return merged;
}

function _mergeWithConversations(
  scenes,
  conversations
) {
  if (conversations.length === 0 || scenes.length === 0) {
    return scenes;
  }

  const orig = scenes.length;

  let merged = [];

  for (let i = 0; i < conversations.length; i += 1) {
    const conversation = conversations[i];

    const {
      start,
      end,
    } = conversation;

    let stack = [];

    while (scenes.length) {
      const scene = scenes[0];

      const {
        timeStart,
        timeEnd,
        technicalCueType,
        fadeOutBlack,
      } = scene;

      if (timeStart > end) {
        break;
      }

      if (timeEnd < start) {
        merged.push(scene);
        scenes.shift();
        continue;
      }

      if (DO_NOT_MERGE.includes(technicalCueType)) {
        if (stack.length > 0) {
          const combined = _mergeFromStack(stack);
          merged.push(combined);

          stack = [];
        }
        merged.push(scene);
        scenes.shift();
        continue;
      }

      if (fadeOutBlack) {
        stack.push(scene);
        const combined = _mergeFromStack(stack);
        merged.push(combined);

        stack = [];
        scenes.shift();
        continue;
      }

      stack.push(scene);
      scenes.shift();
    }

    if (stack.length > 0) {
      const combined = _mergeFromStack(stack);
      merged.push(combined);
    }
  }

  if (scenes.length > 0) {
    merged = merged.concat(scenes);
  }

  merged.sort((a, b) =>
    a.timeStart - b.timeStart);

  console.log(`==== MERGED: ${merged.length} scenes`);
  console.log(`Merge scenes with speech segments: ${orig} -> ${merged.length}`);

  return merged;
}

function _mergeFromStack(stack) {
  let combined;

  if (stack.length === 1) {
    combined = stack[0];
  } else {
    stack.sort((a, b) =>
      a.timeStart - b.timeStart);
    combined = _mergeAB(stack[0], stack[stack.length - 1]);
  }
  return combined;
}

function _mergeScenes(scenes, speeches = []) {
  const stack = [];

  if (scenes.length === 0) {
    return stack;
  }

  stack.push(scenes[0]);

  for (let i = 1; i < scenes.length; i += 1) {
    const prev = stack[stack.length - 1];
    const cur = scenes[i];

    // if we find speeches in these timestamps, merge the scenes
    const [min, max] = _findSpeechIndices(
      speeches,
      [prev.timeEnd, cur.timeStart]
    );

    if (min >= 0 || max >= 0) {
      const merged = _mergeAB(prev, cur);
      stack.pop();
      stack.push(merged);
      continue;
    }

    stack.push(cur);
  }

  console.log(`Scenes = ${scenes.length}, Merged = ${stack.length}`);

  stack.forEach((item, idx) => {
    item.sceneNo = idx;
  });

  for (let i = 1; i < stack.length; i += 1) {
    const prev = stack[i - 1];
    const cur = stack[i];

    if (Math.abs(prev.timeEnd - cur.timeStart) > 300) {
      console.log(`=== DISCONTINUITY: ${prev.smpteEnd} - ${cur.smpteStart}`);
    }

    if (cur.duration < 4000) {
      console.log(`=== SHORT SCENE (<4s): ${cur.smpteStart} - ${cur.smpteEnd}`);
    }
  }

  return stack;
}

function _findSpeechIndices(speeches, timestamps) {
  const indices = [];

  const [timeA, timeB] = timestamps;

  for (let j = 0; j < speeches.length; j += 1) {
    const speech = speeches[j];
    const {
      start,
      end,
    } = speech;

    if (end < timeA) {
      continue;
    }

    if (start > timeB) {
      break;
    }

    indices.push(j);
  }

  if (indices.length === 0) {
    return [-1, -1];
  }

  return [
    Math.min(...indices),
    Math.max(...indices),
  ];
}

function _mergeAB(sceneA, sceneB) {
  console.log(`=== MERGING ${sceneA.sceneNo}, ${sceneB.sceneNo}`);
  const {
    sceneNo,
    shotStart,
    frameStart,
    timeStart,
    smpteStart,
    keyStart,
    technicalCueType,
    simStart,
    fadeInBlack,
  } = sceneA;
  const {
    shotEnd,
    frameEnd,
    timeEnd,
    smpteEnd,
    keyEnd,
    simEnd,
    fadeOutBlack,
  } = sceneB;

  const merged = {
    sceneNo,
    shotStart,
    frameStart,
    timeStart,
    smpteStart,
    keyStart,
    shotEnd,
    frameEnd,
    timeEnd,
    smpteEnd,
    keyEnd,
    technicalCueType,
    simStart,
    simEnd,
    fadeInBlack,
    fadeOutBlack,
  };

  merged.duration = timeEnd - timeStart;

  return merged;
}

async function _downloadSpeeches(
  bucket,
  key,
  field
) {
  const parsed = PATH.parse(key);

  if (parsed.ext === '.json') {
    return CommonUtils.download(bucket, key)
      .then((res) => {
        // convert to milliseconds
        res[field]
          .forEach((item) => {
            item.start = Math.round(item.start * 1000);
            item.end = Math.round(item.end * 1000);
          });
        return res;
      });
  }

  if (parsed.ext === '.vtt') {
    return WebVttHelper.download(bucket, key)
      .then((res) => {
        const cues = res.cues
          .map((cue) => ({
            start: Math.round(cue.start * 1000),
            end: Math.round(cue.end * 1000),
          }))
          .sort((a, b) => {
            if (a.start < b.start) {
              return -1;
            }
            if (a.start > b.start) {
              return 1;
            }
            return b.end - a.end;
          });

        // check for speech collision
        const stack = [];

        if (cues.length > 0) {
          stack.push(cues[0]);

          for (let i = 1; i < cues.length; i += 1) {
            const prev = stack[stack.length - 1];
            const cur = cues[i];

            if (cur.start <= prev.end) {
              const item = {
                start: Math.min(cur.start, prev.start),
                end: Math.max(cur.end, prev.end),
              };
              stack.pop();
              stack.push(item);
              continue;
            }

            // merge short pauses
            if ((cur.start - prev.end) < 400) {
              const item = {
                start: Math.min(cur.start, prev.start),
                end: Math.max(cur.end, prev.end),
              };
              stack.pop();
              stack.push(item);
              continue;
            }

            stack.push(cur);
          }
        }

        return {
          [field]: stack,
        };
      });
  }

  return {
    [field]: [],
  };
}

async function _downloadConversations(
  bucket,
  key,
  field
) {
  if (key === undefined) {
    return undefined;
  }

  return CommonUtils.download(bucket, key)
    .then((res) => {
      const parsed = [];

      const {
        chapters = [],
      } = JSON.parse(res);

      for (let i = 0; i < chapters.length; i += 1) {
        const chapter = chapters[i];
        const {
          start,
          end,
          reason,
        } = chapter;

        const _start = _toMilliseconds(start);
        if (_start < 0) {
          continue;
        }

        const _end = _toMilliseconds(end);
        if (_end < 0) {
          continue;
        }

        parsed.push({
          start: _start,
          end: _end,
          reason,
        });
      }

      parsed.sort((a, b) =>
        a.start - b.start);

      return {
        [field]: parsed,
      };
    })
    .catch((e) => ({
      [field]: [],
    }));
}

function _toMilliseconds(timestamp) {
  if (typeof timestamp === 'number') {
    return timestamp;
  }

  // 00:00:21.520
  const regex = /^([0-9]+):([0-9]+):([0-9]+)\.([0-9]+)$/;
  const matched = timestamp.match(regex);

  if (!matched) {
    return -1;
  }
  const hh = Number(matched[1]);
  const mm = Number(matched[2]);
  const ss = Number(matched[3]);
  const ms = Number(matched[4]);

  return (
    (hh * 3600000) +
    (mm * 60000) +
    (ss * 1000) +
    ms
  );
}

function _toHHMMSS(msec, withMsec) {
  return CommonUtils.toHHMMSS(msec, withMsec);
}

function _setFilterSettings(userFilterSettings = {}) {
  if (userFilterSettings.enhanceWithTranscript !== undefined) {
    FilterSettings.enhanceWithTranscript = !!(userFilterSettings.enhanceWithTranscript);
  }
}

module.exports = StateSceneEnhancement;
