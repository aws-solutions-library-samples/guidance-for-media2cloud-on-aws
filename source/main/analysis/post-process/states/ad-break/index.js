// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const FS = require('node:fs');
const PATH = require('node:path');
const {
  AnalysisTypes: {
    AdBreak,
    Rekognition: {
      Segment,
      Label,
    },
    Scene,
  },
  CommonUtils,
  CSVParser,
  WebVttHelper,
  JimpHelper: {
    MIME_JPEG,
    imageFromBuffer,
    imageFromScratch,
    compareHashes,
  },
} = require('core-lib');
const Regression = require('core-lib/node_modules/regression');
const BaseState = require('../shared/base');

const RED = '\x1b[41m';
const GREEN = '\x1b[42m';
const WHITE = '\x1b[47m';
const HLT = '\x1b[32m';
const CLR = '\x1b[0m';

const ENABLE_IMAGE_TILE = true;

const JSON_FRAME_HASH = 'frameHash.json';
// fix the loudness record 3s drift from MediaConvert
const HOTFIX_LOUDNESS_3S_DRIFT = true;
const LOUDNESS = 'loudness';
const SPEECHES = 'speeches';
// EBU defined for normal dialogue, https://tech.ebu.ch/docs/r/r128s1.pdf
const LUFS_NO_DATA = -120.0;
// breaks are less than 10s apart
// technical cue based breaks
const CUE_BREAKS = [
  'ColorBars',
  'BlackFrames',
  'StudioLogo',
  'Slate',
  // 'EndCredits',
  // 'OpeningCredits',
  // 'Content',
  // 'undefined',
];
const CONTENT_GROUP = [
  'Content',
  'undefined',
];
const CUE_CREDITS = [
  'OpeningCredits',
  'EndCredits',
];

// break at beginning or end of a scene
const SCENE_BREAK = {
  SceneBegin: 'SCENE_BEGIN',
  SceneEnd: 'SCENE_END',
};
// break ladder based on the content duration
const BREAK_LADDER = {
  Min60: {
    Duration: 60 * 60 * 1000,
    BreakMark: 10 * 60 * 1000,
    BreakOffset: 120 * 1000,
  },
  Min40: {
    Duration: 40 * 60 * 1000,
    BreakMark: 8 * 60 * 1000,
    BreakOffset: 120 * 1000,
  },
  Min20: {
    Duration: 20 * 60 * 1000,
    BreakMark: 6 * 60 * 1000,
    BreakOffset: 120 * 1000,
  },
  Min10: {
    Duration: 10 * 60 * 1000,
    BreakMark: 4 * 60 * 1000,
    BreakOffset: 60 * 1000,
  },
  LessThan10: {
    Duration: 1 * 60 * 1000,
    BreakMark: 2 * 60 * 1000,
    BreakOffset: 60 * 1000,
  },
};
const TILE_W = 320;
const TILE_H = 180;

const DEFAULT_WEIGHT_FILTER = {
  pauseWeight: 0.5,
  quietnessWeight: 1,
  contextualWeight: 1,
};
const WeightFilter = DEFAULT_WEIGHT_FILTER;

let BreakFilter;

class StateAdBreakDetection extends BaseState {
  constructor(event, context) {
    super(event, context);

    const {
      input: {
        aiOptions: {
          filters = {},
        },
      },
    } = this.stateData;

    if (filters[AdBreak]) {
      _setFilterSettings(filters[AdBreak]);
    }
  }

  static opSupported(op) {
    return op === 'StateAdBreakDetection';
  }

  async process() {
    if ((this.stateData.data.video.rekognition[Scene] || {}).embeddings === undefined) {
      return this.stateData;
    }

    const {
      input: {
        destination: {
          bucket: proxyBucket,
          prefix: proxyPrefix,
        },
      },
      data: {
        video: {
          rekognition: {
            [Scene]: {
              embeddings: sceneEmbeddingsKey,
            },
            [AdBreak]: originalOption,
          },
        },
      },
    } = this.stateData;

    const startTime = Date.now();

    const framePrefix = PATH.parse(sceneEmbeddingsKey).dir;
    const adbreakPrefix = PATH.join(
      proxyPrefix,
      'metadata',
      AdBreak
    );

    const outputs = await this.downloadOutputs();
    if (outputs === undefined) {
      return this.stateData;
    }

    const breaks = _parseAdBreaks(outputs);

    const rankings = breaks
      .map((x) => ({
        breakNo: x.breakNo,
        weight: x.weight,
      }))
      .sort((a, b) =>
        b.weight - a.weight)
      .map((x, idx) => ({
        ...x,
        ranking: idx,
      }))
      .sort((a, b) =>
        a.breakNo - b.breakNo);

    console.log('=== AD BREAKS ===');

    breaks.sort((a, b) =>
      b.weight - a.weight);

    for (let i = 0; i < breaks.length; i += 1) {
      const breakItem = breaks[i];
      const {
        breakNo,
        breakType,
        smpteTimestamp,
        weight,
        scene: {
          sceneNo,
          timeStart,
          timeEnd,
          duration,
          technicalCueType,
          fadeInBlack,
          fadeOutBlack,
        },
      } = breakItem;
      const {
        ranking,
      } = rankings[breakNo];

      breakItem.ranking = ranking;
      breakItem.images = [];

      let msg = `${HLT}[Rank#${String(ranking).padStart(2, '0')}]${CLR}`;
      msg = `${msg}[${smpteTimestamp}]`;
      msg = `${msg}[#${String(breakNo).padStart(2, '0')}]`;
      msg = `${msg}[scene#${String(sceneNo).padStart(3, '0')}]`;
      msg = `${msg} ${breakType.padStart(11, ' ')}`;
      msg = `${msg} ${_toHHMMSS(timeStart)} -> ${_toHHMMSS(timeEnd)} (${_toHHMMSS(duration)})`;
      msg = `${msg} [${technicalCueType.slice(0, 5)}]`;
      msg = `${msg} FadeInOut = [${fadeInBlack ? 1 : 0},${fadeOutBlack ? 1 : 0}]`;
      msg = `${msg} Weight = ${weight.toFixed(4)}`;
      console.log(msg);

      if (ENABLE_IMAGE_TILE) {
        const image = await _debugDump(
          breakItem,
          outputs.framehashes,
          proxyBucket,
          adbreakPrefix,
          framePrefix
        );
        if (image !== undefined) {
          breakItem.images.push(image);
        }
      }
    }

    breaks.sort((a, b) =>
      a.breakNo - b.breakNo);

    const data = {
      framePrefix,
      [AdBreak]: breaks,
    };

    const name = `${AdBreak}.json`;
    const key = PATH.join(adbreakPrefix, name);

    return CommonUtils.uploadFile(
      proxyBucket,
      adbreakPrefix,
      name,
      data
    ).then(() => {
      this.stateData.data.video.rekognition[AdBreak] = {
        ...originalOption,
        startTime,
        endTime: Date.now(),
        key,
      };

      return this.stateData;
    });
  }

  async downloadOutputs() {
    try {
      const {
        input: {
          destination: {
            bucket: proxyBucket,
          },
          video: {
            key: videoKey,
          },
        },
        data: {
          audio: {
            transcribe: {
              vtt: transcribeVtt,
            },
          },
          video: {
            rekognition: {
              [Scene]: {
                embeddings: embeddingsKey,
                metadata: sceneMetadataKey,
              },
              framesegmentation: {
                key: framesegmentationKey,
              },
              [Segment]: {
                output: segmentMapKey,
              },
              [Label]: labelOutput,
            },
          },
        },
      } = this.stateData;

      const parsed = PATH.parse(videoKey);
      const loudness = PATH.join(parsed.dir, `${parsed.name}_loudness.csv`);

      const framehashKey = PATH.join(
        PATH.parse(framesegmentationKey).dir,
        JSON_FRAME_HASH
      );

      let promises = [];

      promises.push(_downloadJson(proxyBucket, embeddingsKey, 'embeddings'));
      promises.push(_downloadJson(proxyBucket, framesegmentationKey, 'framesegmentation'));
      promises.push(_downloadJson(proxyBucket, framehashKey, 'framehashes'));
      promises.push(_downloadJson(proxyBucket, sceneMetadataKey, Scene));
      promises.push(_downloadJsonFromMap(proxyBucket, segmentMapKey, Segment));
      promises.push(_downloadLoudnessess(proxyBucket, loudness, LOUDNESS));
      promises.push(_downloadSpeeches(proxyBucket, transcribeVtt, SPEECHES));

      // optional label output
      if ((labelOutput || {}).output) {
        promises.push(_downloadJsonFromMap(proxyBucket, labelOutput.output, Label));
      }

      promises = await Promise.all(promises);
      promises = promises
        .reduce((a0, c0) => ({
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

async function _downloadLoudnessess(bucket, key, field) {
  const response = await CommonUtils.download(bucket, key, false);

  return new Promise((resolve) => {
    let parsed = [];

    response.Body.pipe(CSVParser())
      .on('data', (data) => {
        parsed.push(data);
      })
      .on('end', () => {
        parsed = parsed.map((item) => {
          Object.keys(item).forEach((x) => {
            item[x] = Number(item[x]);
            if (Number.isNaN(item[x])) {
              item[x] = LUFS_NO_DATA;
            }
          });
          return item;
        });

        // loudness measurement requires 3 seconds
        // shift 3 seconds of records and restamp the timestamp
        if (HOTFIX_LOUDNESS_3S_DRIFT) {
          parsed = parsed.slice(3);

          parsed.forEach((x, idx) => {
            x.Seconds = idx + 1;
          });
        }

        parsed = parsed.map((x) => ({
          timestamp: x.Seconds * 1000,
          momentary: x.InputMomentaryLoudness || LUFS_NO_DATA,
        }));

        resolve({
          [field]: parsed,
        });
      });
  });
}

async function _downloadJsonFromMap(bucket, key, field) {
  const mapFile = await _downloadJson(bucket, key, 'tmp')
    .then((res) =>
      res.tmp);

  const parsed = PATH.parse(key);
  const json = PATH.join(parsed.dir, mapFile.file);

  return _downloadJson(bucket, json, field);
}

async function _downloadJson(bucket, key, field) {
  return CommonUtils.download(bucket, key)
    .then((res) => ({
      [field]: JSON.parse(res.toString()),
    }));
}

async function _downloadSpeeches(
  bucket,
  key,
  field
) {
  const parsed = PATH.parse(key);

  if (parsed.ext === '.json') {
    return _downloadJson(bucket, key, field)
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
            if ((cur.start - prev.end) < 600) {
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

function _parseAdBreaks(outputs) {
  const {
    [SPEECHES]: speeches,
    [Scene]: {
      scene: scenes = [],
    },
    [Label]: labels,
    [LOUDNESS]: loudnesses,
    [Segment]: segments,
    framesegmentation: framesegmentations,
    framehashes,
    embeddings,
  } = outputs;

  const loudnessGroups = _groupLoudness(loudnesses);

  framesegmentations.forEach((frame, idx) => {
    frame.embeddings = embeddings[idx].embeddings;
  });

  scenes.forEach((scene) => {
    // meshing all metadata into the scene
    scene.indices = {};

    scene.indices.speeches = _findSpeechIndicesInScene(scene, speeches);
    scene.indices.loudnesses = _findLoudnessIndicesInScene(scene, loudnesses);
    scene.indices.frames = _findFrameIndicesInScene(scene, framehashes);
    scene.indices.embeddings = _findEmbeddingIndicesInScene(scene, framesegmentations);

    const [pauseIn, pauseOut] = _findSceneBoundaryPauses(scene, speeches);
    scene.pauseIn = pauseIn;
    scene.pauseOut = pauseOut;
  });

  const data = {
    scenes,
    speeches,
    loudnesses,
    loudnessGroups,
    framehashes,
    framesegmentations,
    segments,
    labels: (labels || {}).Labels || [],
  };

  const {
    contentTimestamps,
    candidates,
  } = _bestGuessCandidates(scenes);

  console.log('=== _bestGuessCandidates ===');
  console.log(`scenes = ${scenes.length}, candidates = ${candidates.length}`);
  console.log(`content timestamps = ${_toHHMMSS(contentTimestamps[0])} -> ${_toHHMMSS(contentTimestamps[1])}`);

  const breaks = _findBreakCandidates(
    contentTimestamps,
    candidates,
    data
  );

  return breaks;
}

function _findSpeechIndicesInScene(scene, speeches) {
  const indices = [];

  const {
    timeStart,
    timeEnd,
  } = scene;

  for (let j = 0; j < speeches.length; j += 1) {
    const speech = speeches[j];
    const {
      start,
      end,
    } = speech;

    if (end < timeStart) {
      continue;
    }

    if (start > timeEnd) {
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

function _findLoudnessIndicesInScene(scene, loudnesses) {
  const indices = [];

  const {
    timeStart,
    timeEnd,
  } = scene;

  for (let j = 0; j < loudnesses.length; j += 1) {
    const loudness = loudnesses[j];
    const {
      timestamp,
    } = loudness;

    if (timestamp < timeStart) {
      continue;
    }

    if (timestamp > timeEnd) {
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

function _findFrameIndicesInScene(scene, framehashes) {
  const indices = [];

  const {
    timeStart,
    timeEnd,
  } = scene;

  for (let j = 0; j < framehashes.length; j += 1) {
    const frame = framehashes[j];
    const {
      timestamp,
    } = frame;
    if (timestamp < timeStart) {
      continue;
    }

    if (timestamp > timeEnd) {
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

function _findEmbeddingIndicesInScene(scene, embeddings) {
  const indices = [];

  const {
    timeStart,
    timeEnd,
  } = scene;

  for (let j = 0; j < embeddings.length; j += 1) {
    const embedding = embeddings[j];
    const {
      timestamp,
    } = embedding;

    if (timestamp < timeStart) {
      continue;
    }

    if (timestamp > timeEnd) {
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

function _findSceneBoundaryPauses(scene, speeches) {
  const {
    timeStart,
    timeEnd,
    indices: {
      speeches: [min, max],
    },
  } = scene;

  let pauseIn = false;
  let pauseOut = false;

  if (min < 0 || (speeches[min].start - timeStart) > 300) {
    pauseIn = true;
  }

  if (max < 0 || max >= speeches.length || (timeEnd - speeches[max].end) > 300) {
    pauseOut = true;
  }

  return [pauseIn, pauseOut];
}

function _bestGuessCandidates(scenes) {
  const candidates = [];

  // find content start and end points
  const contentTimestamps = [-1, -1];

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const {
      timeStart,
      timeEnd,
      technicalCueType,
      fadeInBlack,
      fadeOutBlack,
      pauseIn,
      pauseOut,
    } = scene;

    if (contentTimestamps[0] < 0 && CONTENT_GROUP.includes(technicalCueType)) {
      contentTimestamps[0] = timeStart;
    }

    if (contentTimestamps[1] < 0 && technicalCueType === 'EndCredits') {
      contentTimestamps[1] = timeEnd;
    }

    if (CUE_BREAKS.includes(technicalCueType)) {
      candidates.push(scene);
      continue;
    }

    if (fadeInBlack || fadeOutBlack) {
      candidates.push(scene);
      continue;
    }

    if (pauseIn || pauseOut) {
      candidates.push(scene);
      continue;
    }
  }

  // special case: content does not have end credits
  if (contentTimestamps[1] < 0 && scenes.length > 0) {
    contentTimestamps[1] = scenes[scenes.length - 1].timeEnd;
  }

  return {
    contentTimestamps,
    candidates,
  };
}

function _findBreakCandidates(
  contentTimestamps,
  candidates,
  data
) {
  const contentDuration = contentTimestamps[1] - contentTimestamps[0];

  let breakSpec = BreakFilter;
  // user defined settings??
  if (BreakFilter !== undefined) {
    breakSpec = BreakFilter;
  } else if (contentDuration > BREAK_LADDER.Min60.Duration) {
    breakSpec = BREAK_LADDER.Min60;
  } else if (contentDuration > BREAK_LADDER.Min40.Duration) {
    breakSpec = BREAK_LADDER.Min40;
  } else if (contentDuration > BREAK_LADDER.Min20.Duration) {
    breakSpec = BREAK_LADDER.Min20;
  } else if (contentDuration > BREAK_LADDER.Min10.Duration) {
    breakSpec = BREAK_LADDER.Min10;
  } else {
    breakSpec = BREAK_LADDER.LessThan10;
  }

  const {
    BreakMark: interval,
    BreakOffset: offset,
  } = breakSpec;

  const sceneGroups = [];

  for (let i = 0; i < contentTimestamps[1]; i += interval) {
    const [min, max] = [
      Math.max(i - offset, 0),
      Math.min(i + offset, contentTimestamps[1]),
    ];

    const sceneGroup = [];

    for (let j = 0; j < candidates.length; j += 1) {
      const candidate = candidates[j];
      const {
        timeStart,
        timeEnd,
      } = candidate;
      if (timeEnd < min) {
        continue;
      }

      if (timeStart > max) {
        break;
      }

      sceneGroup.push(candidate);
    }

    sceneGroups.push({
      groupTimestamps: [min, max],
      sceneGroup,
    });
  }

  let breakCandidates = [];
  for (let i = 0; i < sceneGroups.length; i += 1) {
    const {
      groupTimestamps: [
        start,
        end,
      ],
      sceneGroup,
    } = sceneGroups[i];

    console.log(`\n=== PROCESSING Group#${i} [${_toHHMMSS(start)} -> ${_toHHMMSS(end)}]: (${sceneGroup.length} scenes)`);

    let potentialCandidates = [];
    for (let j = 0; j < sceneGroup.length; j += 1) {
      const scene = sceneGroup[j];
      const {
        technicalCueType,
        timeStart,
        timeEnd,
        smpteStart,
        smpteEnd,
        fadeOutBlack,
        pauseIn,
        pauseOut,
      } = scene;

      if (CUE_BREAKS.includes(technicalCueType)) {
        potentialCandidates.push({
          breakType: SCENE_BREAK.SceneEnd,
          timestamp: timeEnd,
          smpteTimestamp: smpteEnd,
          weight: 1.0,
          scene,
        });
        continue;
      }

      if (fadeOutBlack) {
        potentialCandidates.push({
          breakType: SCENE_BREAK.SceneEnd,
          timestamp: timeEnd,
          smpteTimestamp: smpteEnd,
          weight: 0.8,
          scene,
        });
        continue;
      }

      // skip opening and end credits
      if (CUE_CREDITS.includes(technicalCueType)) {
        continue;
      }

      const boundaries = _collectBoundaryDetails(scene, data);
      scene.boundaries = boundaries;

      if (pauseIn) {
        potentialCandidates.push({
          breakType: SCENE_BREAK.SceneBegin,
          timestamp: timeStart,
          smpteTimestamp: smpteStart,
          weight: scene.boundaries[0].weight,
          scene,
        });
      }
      if (pauseOut) {
        potentialCandidates.push({
          breakType: SCENE_BREAK.SceneEnd,
          timestamp: timeEnd,
          smpteTimestamp: smpteEnd,
          weight: scene.boundaries[1].weight,
          scene,
        });
      }
    }

    potentialCandidates = potentialCandidates
      .filter((x) =>
        x.weight > 0.4)
      .sort((a, b) =>
        a.timestamp - b.timestamp);

    potentialCandidates
      .forEach((candidate) => {
        const {
          scene: {
            sceneNo,
            timeStart,
            timeEnd,
          },
          breakType,
          smpteTimestamp,
          weight,
        } = candidate;

        console.log(`[scene#${sceneNo}]: [${breakType}]: [${_toHHMMSS(timeStart)} -> ${_toHHMMSS(timeEnd)}]: ${smpteTimestamp}, weight = ${weight.toFixed(4)}`);
      });

    breakCandidates = breakCandidates.concat(potentialCandidates);
  }

  breakCandidates.sort((a, b) =>
    a.timestamp - b.timestamp);

  // reduction
  const reduced = [];
  if (breakCandidates.length > 0) {
    reduced.push(breakCandidates[0]);

    for (let i = 1; i < breakCandidates.length; i += 1) {
      const prev = reduced[reduced.length - 1];
      const cur = breakCandidates[i];

      if (prev.timestamp === cur.timestamp) {
        continue;
      }

      if (prev.fadeOutBlack && cur.fadeOutBlack) {
        reduced.push(cur);
        continue;
      }

      // less than 10s
      if ((cur.timestamp - prev.timestamp) < 10000) {
        if (cur.weight > prev.weight) {
          reduced.pop();
          reduced.push(cur);
        }
        continue;
      }

      reduced.push(cur);
    }

    console.log(`\n\n ==== Reduced (${breakCandidates.length} -> ${reduced.length}) ===`);

    for (let i = 0; i < reduced.length; i += 1) {
      const candidate = reduced[i];

      const {
        scene: {
          sceneNo,
          timeStart,
          timeEnd,
          boundaries = [],
        },
        breakType,
        timestamp,
        smpteTimestamp,
        weight,
      } = candidate;

      candidate.breakNo = i;

      const contextuals = _collectLabelCategories(
        timestamp,
        data.labels
      );
      candidate.contextual = {
        before: contextuals[0],
        after: contextuals[1],
        distance: 0,
      };

      const taxonomies = _findTaxonomiesAtBoundary(
        candidate,
        data.scenes
      );
      candidate.taxonomies = taxonomies;

      // for backward compatible only
      candidate.pause = {
        pauseStart: 0,
        pauseEnd: 0,
        pauseDuration: 0,
      };

      if (breakType === SCENE_BREAK.SceneBegin) {
        const {
          scene: {
            keyStart: key,
            indices: {
              loudnesses: [idx, notused],
            },
          },
        } = candidate;

        if (boundaries[0]) {
          const {
            pause,
          } = boundaries[0];
          candidate.pause = {
            pauseStart: pause[2][0],
            pauseEnd: pause[2][1],
            pauseDuration: pause[2][1] - pause[2][0],
          };
        }
        candidate.key = key;
        candidate.momentary = (data.loudnesses[idx] || {}).momentary || LUFS_NO_DATA;
      } else {
        const {
          scene: {
            keyEnd: key,
            indices: {
              loudnesses: [notused, idx],
            },
          },
        } = candidate;

        if (boundaries[1]) {
          const {
            pause,
          } = boundaries[1];
          candidate.pause = {
            pauseStart: pause[2][0],
            pauseEnd: pause[2][1],
            pauseDuration: pause[2][1] - pause[2][0],
          };
        }

        candidate.key = key;
        candidate.momentary = (data.loudnesses[idx] || {}).momentary || LUFS_NO_DATA;

        // for backward compatible only
        candidate.normalization = {
          quietness: 0,
          contextualDistance: 0,
          pauseDuration: 0,
          pauseDistance: 0,
          scale: 1.0,
        };

        delete candidate.scene.simStart;
        delete candidate.scene.simEnd;
      }

      console.log(`[scene#${sceneNo}]: [${breakType}]: [${_toHHMMSS(timeStart)} -> ${_toHHMMSS(timeEnd)}]: ${smpteTimestamp}, weight = ${weight.toFixed(4)}`);
    }
  }

  return reduced;
}

function _collectBoundaryDetails(
  scene,
  data
) {
  // visual changes
  const [
    framesA,
    framesB,
  ] = _collectBoundaryFrames(
    scene,
    data.framehashes,
    10
  );

  const [
    simA,
    simB,
  ] = _computeBoundarySimilarities(
    scene,
    data.framesegmentations
  );

  const [
    perceptualChangeRateA,
    perceptualChangeRateB,
  ] = [framesA, framesB]
    .map((frames) =>
      _computePerceptualChangeRate(scene, frames));

  const [
    [laplacianChangeA, laplacianChangeRateA],
    [laplacianChangeB, laplacianChangeRateB],
  ] = [framesA, framesB]
    .map((frames) =>
      _computeLaplacianChanges(scene, frames));

  // audio changes
  const [
    loudnessesA,
    loudnessesB,
  ] = _collectBoundaryLoudnesses(
    scene,
    data.loudnesses
  );

  const [
    momentaryA,
    momentaryB,
    loudnessGroupA,
    loudnessGroupB,
  ] = _findMomentaryLoudness(
    scene,
    data.loudnesses,
    data.loudnessGroups
  );

  const [
    [loudnessChangeA, loudnessChangeRateA],
    [loudnessChangeB, loudnessChangeRateB],
  ] = [loudnessesA, loudnessesB]
    .map((loudnesses) =>
      _computeLoudnessChanges(scene, loudnesses));

  const [
    pauseA,
    pauseB,
  ] = _collectBoundaryPauses(
    scene,
    data.speeches
  );

  let diffA = 0;
  let diffB = 0;

  if (simA !== -1) {
    diffA = 1 - simA;
  }
  if (simB !== -1) {
    diffB = 1 - simB;
  }

  const {
    pauseWeight,
    quietnessWeight,
    contextualWeight,
  } = WeightFilter;

  const matA = [
    (diffA * contextualWeight),
    perceptualChangeRateA,
    // laplacianChangeA,
    laplacianChangeRateA,
    (momentaryA / LUFS_NO_DATA) * quietnessWeight,
    // loudnessChangeA,
    loudnessChangeRateA,
    loudnessGroupA[0],
    (pauseA[0] * pauseWeight),
  ];
  const weightA = _meanValue(matA) * 0.8;

  const boundaryA = {
    weight: weightA,
    sim: simA,
    pause: pauseA,
    // perceptualChangeRate: perceptualChangeRateA,
    // laplacianChange: laplacianChangeA,
    // laplacianChangeRate: laplacianChangeRateA,
    // loudnessChange: loudnessChangeA,
    // loudnessChangeRate: loudnessChangeRateA,
    mat: matA,
  };

  const matB = [
    (diffB * contextualWeight),
    perceptualChangeRateB,
    // laplacianChangeB,
    laplacianChangeRateB,
    (momentaryB / LUFS_NO_DATA) * quietnessWeight,
    // loudnessChangeB,
    loudnessChangeRateB,
    loudnessGroupB[0],
    (pauseB[0] * pauseWeight),
  ];
  const weightB = _meanValue(matB) * 0.8;

  const boundaryB = {
    weight: weightB,
    sim: simB,
    pause: pauseB,
    // perceptualChangeRate: perceptualChangeRateB,
    // laplacianChange: laplacianChangeB,
    // laplacianChangeRate: laplacianChangeRateB,
    // loudnessChange: loudnessChangeB,
    // loudnessChangeRate: loudnessChangeRateB,
    mat: matB,
  };

  return [boundaryA, boundaryB];
}

function _collectBoundaryFrames(
  scene,
  framehashes,
  offset = 10
) {
  const {
    indices: {
      frames: [idxA, idxB],
    },
  } = scene;

  let framesA = [];
  let framesB = [];

  if (idxA >= 0) {
    const min = Math.max(0, idxA - offset);
    const max = Math.min(idxA + offset, framehashes.length - 1);
    framesA = framehashes.slice(min, max);
  }

  if (idxB >= 0) {
    const min = Math.max(0, (idxB - offset));
    const max = Math.min((idxB + offset), (framehashes.length - 1));
    framesB = framehashes.slice(min, max);
  }

  framesA.sort((a, b) =>
    a.timestamp - b.timestamp);
  framesB.sort((a, b) =>
    a.timestamp - b.timestamp);

  return [framesA, framesB];
}

function _computeBoundarySimilarities(
  scene,
  framesegmentations
) {
  const {
    indices: {
      embeddings: [idxA, idxB],
    },
  } = scene;

  const [simA, simB] = [
    [idxA - 1, idxA],
    [idxB, idxB + 1],
  ].map((range) => {
    const [min, max] = range;
    const frameA = framesegmentations[min];
    const frameB = framesegmentations[max];
    if (frameA === undefined || frameB === undefined) {
      return 1;
    }

    return _cosineSimilarity(
      frameA.embeddings,
      frameB.embeddings
    );
  });

  return [simA, simB];
}

function _cosineSimilarity(arrayA, arrayB) {
  let dotProduct = 0;
  let meanA = 0;
  let meanB = 0;

  for (let i = 0; i < arrayA.length; i += 1) {
    dotProduct += arrayA[i] * arrayB[i];
    meanA += arrayA[i] ** 2;
    meanB += arrayB[i] ** 2;
  }

  meanA **= 0.5;
  meanB **= 0.5;

  if ((meanA * meanB) === 0) {
    return 0;
  }

  return dotProduct / (meanA * meanB);
}

function _meanValue(arrayB) {
  let meanB = 0;

  let sum = 0;
  for (let i = 0; i < arrayB.length; i += 1) {
    let val = arrayB[i];
    if (Number.isNaN(val) || !val) {
      val = 0;
    }
    val = Math.abs(val);

    sum += val;
    meanB += val ** 2;
  }

  // const size = arrayB.length ** 0.5;
  // meanB **= 0.5;

  meanB = (meanB * arrayB.length) ** 0.5;

  if (meanB === 0) {
    return 0;
  }

  // return sum / (meanB * size);
  return sum / meanB;
}

function _computeLaplacianChanges(
  scene,
  frames
) {
  let datapoints = frames
    .map((x) => ([
      x.timestamp / 1000,
      x.laplacian,
    ]));

  if (datapoints.length < 2) {
    return [0, 0];
  }

  // laplacian changes over time
  let result = Regression.linear(datapoints, { precision: 4 });
  const change = result.equation[0];

  datapoints = [];
  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1];
    const cur = frames[i];

    datapoints.push([
      cur.timestamp / 1000,
      cur.laplacian - prev.laplacian,
    ]);
  }

  if (datapoints.length < 2) {
    return [change, 0];
  }

  // the rate of laplacian changes over time
  result = Regression.linear(datapoints, { precision: 4 });
  const changeRate = result.equation[0];

  return [change, changeRate];
}

function _computePerceptualChangeRate(
  scene,
  frames
) {
  if (frames.length === 0) {
    return 0;
  }

  const datapoints = [];

  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1];
    const cur = frames[i];
    const perceptual = compareHashes(prev.hash, cur.hash);
    datapoints.push([
      cur.timestamp / 1000,
      perceptual,
    ]);
  }

  // the rate of laplacian changes over time
  const result = Regression.linear(datapoints, { precision: 4 });
  const changeRate = result.equation[0];

  return changeRate;
}

function _collectBoundaryLoudnesses(
  scene,
  loudnesses,
  offset = 10
) {
  const {
    indices: {
      loudnesses: [idxA, idxB],
    },
  } = scene;

  let loudnessesA = [];
  let loudnessesB = [];

  if (idxA >= 0) {
    const min = Math.max(0, idxA - offset);
    const max = Math.min(idxA + offset, loudnesses.length - 1);
    loudnessesA = loudnesses.slice(min, max);
  }
  if (idxB >= 0) {
    const min = Math.max(0, (idxB - offset));
    const max = Math.min((idxB + offset), (loudnesses.length - 1));
    loudnessesB = loudnesses.slice(min, max);
  }

  loudnessesA.sort((a, b) =>
    a.timestamp - b.timestamp);
  loudnessesB.sort((a, b) =>
    a.timestamp - b.timestamp);

  return [loudnessesA, loudnessesB];
}

function _findMomentaryLoudness(
  scene,
  loudnesses,
  loudnessGroups
) {
  const {
    indices: {
      loudnesses: [idxA, idxB],
    },
    timeStart,
    timeEnd,
  } = scene;

  let momentaryA = LUFS_NO_DATA;
  let momentaryB = LUFS_NO_DATA;

  if (idxA >= 0) {
    momentaryA = loudnesses[idxA].momentary || LUFS_NO_DATA;
  }

  if (idxB >= 0) {
    momentaryB = loudnesses[idxB].momentary || LUFS_NO_DATA;
  }

  let groupA = [0, [0, 0]];
  let groupB = [0, [0, 0]];

  for (let i = 0; i < loudnessGroups.length - 1; i += 1) {
    const curGroup = loudnessGroups[i];
    const nextGroup = loudnessGroups[i + 1];

    if (curGroup.start > timeEnd) {
      break;
    }

    if (nextGroup.end < timeStart) {
      continue;
    }

    // timestamp within the group change, best scenario
    if (timeStart >= curGroup.end && timeStart <= nextGroup.start) {
      groupA = [1, [curGroup.end, nextGroup.start]];
    }

    if (timeEnd >= curGroup.end && timeEnd <= nextGroup.start) {
      groupB = [1, [curGroup.end, nextGroup.start]];
    }

    // in a loudness group, calculate the distance to the next group
    if (timeStart > curGroup.start && timeStart < curGroup.end) {
      const ratio = Math.max(
        Math.abs(curGroup.start - timeStart),
        Math.abs(curGroup.end - timeStart)
      ) / (curGroup.end - curGroup.start);
      groupA = [ratio, [curGroup.start, curGroup.end]];
    }

    if (timeEnd > curGroup.start && timeEnd < curGroup.end) {
      const ratio = Math.max(
        Math.abs(curGroup.start - timeEnd),
        Math.abs(curGroup.end - timeEnd)
      ) / (curGroup.end - curGroup.start);
      groupB = [ratio, [curGroup.start, curGroup.end]];
    }
  }

  return [momentaryA, momentaryB, groupA, groupB];
}

function _computeLoudnessChanges(
  scene,
  loudnesses
) {
  let datapoints = loudnesses
    .map((x) => ([
      x.timestamp / 1000,
      x.momentary || LUFS_NO_DATA,
    ]));

  if (datapoints.length < 2) {
    return [0, 0];
  }

  // laplacian changes over time
  let result = Regression.linear(datapoints, { precision: 4 });
  const change = result.equation[0];

  datapoints = [];
  for (let i = 1; i < loudnesses.length; i += 1) {
    const prev = loudnesses[i - 1];
    const cur = loudnesses[i];

    datapoints.push([
      cur.timestamp / 1000,
      (cur.momentary || LUFS_NO_DATA) - (prev.momentary || LUFS_NO_DATA),
    ]);
  }

  if (datapoints.length < 2) {
    return [change, 0];
  }

  // the rate of laplacian changes over time
  result = Regression.linear(datapoints, { precision: 4 });
  const changeRate = result.equation[0];

  return [change, changeRate];
}

function _collectBoundaryPauses(
  scene,
  speeches
) {
  const {
    timeStart,
    timeEnd,
    indices: {
      speeches: [idxA, idxB],
    },
    pauseIn,
    pauseOut,
  } = scene;

  let pauseA;
  let pauseB;

  if (idxA < 0) {
    pauseA = [(timeEnd - timeStart) / 1000, timeStart, [timeStart, timeEnd]];
  } else if (pauseIn !== true) {
    pauseA = [0, timeStart, [timeStart, timeStart]];
  } else {
    let start = timeStart;
    let end = timeStart;

    const prev = speeches[idxA - 1];
    if (prev) {
      start = prev.end;
    }

    const cur = speeches[idxA];
    if (cur) {
      end = cur.start;
    }

    // pick the shortest pause segments relative to scene begin boundary
    const shortest = Math.min(
      Math.abs(timeStart - start),
      Math.abs(end - timeStart)
    ) / 1000;
    pauseA = [shortest, timeStart, [start, end]];
  }

  if (idxB < 0) {
    pauseB = [(timeEnd - timeStart) / 1000, timeEnd, [timeStart, timeEnd]];
  } else if (pauseOut !== true) {
    pauseB = [0, timeEnd, [timeEnd, timeEnd]];
  } else {
    let start = timeEnd;
    let end = timeEnd;

    const prev = speeches[idxB];
    if (prev) {
      start = prev.end;
    }

    const cur = speeches[idxB + 1];
    if (cur) {
      end = cur.start;
    }

    // pick the shortest pause segments relative to scene end boundary
    const shortest = Math.min(
      Math.abs(timeEnd - start),
      Math.abs(end - timeEnd)
    ) / 1000;

    pauseB = [shortest, timeEnd, [start, end]];
  }

  return [pauseA, pauseB];
}

function _collectLabelCategories(timestamp, labels, offset = 5000) {
  const [min, max] = [
    timestamp - offset,
    timestamp + offset,
  ];

  let categoriesA = [];
  let categoriesB = [];

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const {
      Timestamp: t,
    } = label;

    if (t < min) {
      continue;
    }
    if (t > max) {
      break;
    }

    if (t >= min && t < timestamp) {
      const {
        Label: {
          Categories: categories = [],
        },
      } = label;
      categories.forEach((x) =>
        categoriesA.push(x.Name));
    }

    if (t > timestamp && t <= max) {
      const {
        Label: {
          Categories: categories = [],
        },
      } = label;
      categories.forEach((x) =>
        categoriesB.push(x.Name));
    }
  }

  categoriesA = [
    ...new Set(categoriesA),
  ].sort();

  categoriesB = [
    ...new Set(categoriesB),
  ].sort();

  return [categoriesA, categoriesB];
}

function _findTaxonomiesAtBoundary(candidate, scenes) {
  const {
    breakType,
    scene: {
      sceneNo,
    },
  } = candidate;

  let sceneA = scenes[sceneNo - 1];
  let sceneB = scenes[sceneNo];

  if (breakType === SCENE_BREAK.SceneEnd) {
    sceneA = scenes[sceneNo];
    sceneB = scenes[sceneNo + 1];
  }

  const taxonomies = {};
  if (((sceneA || {}).details || []).length > 0) {
    taxonomies.before = sceneA.details;
  }

  if (((sceneB || {}).details || []).length > 0) {
    taxonomies.after = sceneB.details;
  }

  if (taxonomies.before === undefined && taxonomies.after === undefined) {
    return undefined;
  }

  return taxonomies;
}

function _toHHMMSS(msec, withMsec) {
  return CommonUtils.toHHMMSS(msec, withMsec);
}

function _setFilterSettings(userFilterSettings = {}) {
  try {
    const {
      breakInterval = 0,
      breakOffset = 0,
      pauseWeight = WeightFilter.pauseWeight,
      quietnessWeight = WeightFilter.quietnessWeight,
      contextualWeight = WeightFilter.contextualWeight,
    } = userFilterSettings;

    const _breakInterval = Number(breakInterval);
    const _breakOffset = Number(breakOffset);

    // interval must be at least 1 min long
    // and offset must be less than internval / 2
    if (
      !Number.isNaN(_breakInterval) &&
      !Number.isNaN(_breakOffset) &&
      (_breakInterval >= 1 * 60 * 1000) &&
      (_breakOffset <= Math.round(_breakInterval / 2))
    ) {
      // set global variable
      BreakFilter = {
        BreakMark: _breakInterval,
        BreakOffset: _breakOffset,
      };
    }

    // apply weight filter settings
    const _pauseWeight = Number(pauseWeight);
    const _quietnessWeight = Number(quietnessWeight);
    const _contextualWeight = Number(contextualWeight);

    if (!Number.isNaN(_pauseWeight)) {
      WeightFilter.pauseWeight = Math.min(
        Math.max(_pauseWeight, 0),
        1
      );
    }

    if (!Number.isNaN(_quietnessWeight)) {
      WeightFilter.quietnessWeight = Math.min(
        Math.max(_quietnessWeight, 0),
        1
      );
    }

    if (!Number.isNaN(_contextualWeight)) {
      WeightFilter.contextualWeight = Math.min(
        Math.max(_contextualWeight, 0),
        1
      );
    }
  } catch (e) {
    // do nothing
  }
}

async function _debugDump(
  breakItem,
  framehashes,
  bucket,
  prefix,
  framePrefix
) {
  const {
    breakNo,
    breakType,
    ranking,
    weight,
    timestamp,
    smpteTimestamp,
    scene,
  } = breakItem;

  const [framesA, framesB] = _collectBoundaryFrames(
    scene,
    framehashes,
    5
  );

  let frames = framesA;
  if (breakType === SCENE_BREAK.SceneEnd) {
    frames = framesB;
  }

  if (frames.length === 0) {
    return undefined;
  }

  let image = await _tileImages(
    bucket,
    framePrefix,
    frames
  );
  image = await image.getBufferAsync(MIME_JPEG);

  // ranking, break#, weight, smpte
  // 01_02_0.4321_00-01-23-12.jpg
  const timecode = smpteTimestamp.replace(/[:;]/g, '-');
  let name = [
    String(ranking).padStart(2, '0'),
    String(breakNo).padStart(2, '0'),
    weight.toFixed(3),
    timecode,
  ].join('_');
  name = `${name}.jpg`;

  if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
    FS.writeFileSync(name, image);
  }

  return CommonUtils.uploadFile(
    bucket,
    prefix,
    name,
    image
  ).then(() =>
    name);
}

async function _tileImages(bucket, prefix, frames) {
  frames.sort((a, b) =>
    a.timestamp - b.timestamp);

  const imgW = TILE_W * frames.length;
  const imgH = TILE_H;

  const combined = await imageFromScratch(imgW, imgH);

  let promises = frames.map((frame) =>
    CommonUtils.download(
      bucket,
      PATH.join(prefix, frame.name),
      false
    ).then((res) =>
      res.Body.transformToByteArray()));

  promises = await Promise.all(await Promise.all(promises));

  for (let col = 0; col < frames.length; col += 1) {
    const frame = frames[col];
    // const key = PATH.join(prefix, frame.name);

    // let buf = await (await CommonUtils.download(bucket, key, false)
    //   .then((res) =>
    //     res.Body.transformToByteArray()));
    // buf = Buffer.from(buf);
    const buf = Buffer.from(promises[col]);

    let tile = await imageFromBuffer(buf);

    const factor = TILE_W / tile.bitmap.width;
    const scaled = tile.scale(factor);
    const w = scaled.bitmap.width - 4;
    const h = scaled.bitmap.height - 4;
    tile = tile.crop(2, 2, w, h);

    const l = col * TILE_W + 2;
    const t = 2;
    combined.blit(tile, l, t);
  }

  return combined.quality(80);
}

function _groupLoudness(loudnesses) {
  const datapoints = loudnesses
    .map((item) => {
      const {
        timestamp,
        momentary,
      } = item;
      let datapoint = momentary;
      if (datapoint < LUFS_NO_DATA) {
        datapoint = LUFS_NO_DATA;
      }
      return [datapoint, timestamp];
    });

  let groups = _groupItemsByDatapoint(datapoints);

  groups = groups.map((group) => {
    const timestamps = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    const data = [];

    group.forEach((item) => {
      timestamps[0] = Math.min(item[1], timestamps[0]);
      timestamps[1] = Math.max(item[1], timestamps[1]);
      data.push(item[0]);
    });

    const momentary = _calculateMean(data);

    return {
      start: timestamps[0],
      end: timestamps[1],
      momentary,
    };
  });

  return groups;
}

function _calculateMean(array) {
  if (array.length === 0) {
    return 0;
  }

  const sum = array
    .reduce((a, b) =>
      a + b, 0);

  return sum / array.length;
}

function _calculateRMS(array) {
  if (array.length === 0) {
    return 0;
  }

  const sum = array
    .reduce((a, b) =>
      a + (b ** 2), 0);

  return (sum / array.length) ** 0.5;
}

function _groupItemsByDatapoint(array, minMargin = 5) {
  if (array.length === 0) {
    return [];
  }

  // Sort the array based on timestamps
  array.sort((a, b) =>
    a[1] - b[1]);

  const groups = [];
  let currentGroup = [array[0]];

  for (let i = 1; i < array.length; i++) {
    const [datapoint, timestamp] = array[i];
    const lastTimestamp = currentGroup[currentGroup.length - 1][1];
    const lastDatapoint = currentGroup[currentGroup.length - 1][0];

    let margin = Math.abs(datapoint - lastDatapoint) / currentGroup.length;
    margin = Math.max(minMargin, margin);

    if (
      (Math.abs(datapoint - currentGroup[0][0]) <= margin) &&
      (timestamp - lastTimestamp <= 1000)
    ) {
      currentGroup.push([datapoint, timestamp]);
    } else {
      groups.push(currentGroup);
      currentGroup = [[datapoint, timestamp]];
    }
  }

  // Push the last group
  groups.push(currentGroup);

  return groups;
}

module.exports = StateAdBreakDetection;
