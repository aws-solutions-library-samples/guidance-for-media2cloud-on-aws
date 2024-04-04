// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  StateData,
  M2CException,
  AnalysisTypes: {
    Rekognition: {
      Segment,
    },
    Scene,
  },
  CommonUtils,
  WebVttTrack,
  TimecodeUtils: {
    framerateToEnum,
    fromTimecode,
    toTimecode,
    framesToMilliseconds,
  },
} = require('core-lib');

const JSON_SCENE = `${Scene}.json`;
const JSON_FRAME_HASH = 'frameHash.json';
const BURST_DISTANCE = 2 * 1000; // 2s
const ONE_MIN = 60 * 1000;
const THREE_MINS = 3 * ONE_MIN;
const TEN_MINS = 10 * ONE_MIN;
const SCAN_MODE = {
  Backward: 0,
  Forward: 1,
};
const FilterSettings = {
  minFrameSimilarity: 0.80,
  maxTimeDistance: THREE_MINS,
};
const CUE_BREAKS = [
  'ColorBars',
  'BlackFrames',
  'StudioLogo',
  'Slate',
];

let TimecodeSettings = {
  enumFPS: undefined,
  dropFrame: undefined,
};

class StateCreateSceneEvents {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
    }
    this.$stateData = stateData;

    const {
      data: {
        [Scene]: {
          filterSettings,
        },
      },
    } = this.stateData;
    _setFilterSettings(filterSettings);
  }

  get [Symbol.toStringTag]() {
    return 'StateCreateSceneEvents';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const {
      input: {
        destination: {
          bucket,
          prefix,
        },
      },
      data: {
        framesegmentation: {
          key: framesegmentationKey,
        },
      },
    } = this.stateData;
    const framePrefix = PATH.parse(framesegmentationKey).dir;

    const {
      segments,
      framesegmentations,
      similarity,
      embeddings,
      framehashes,
    } = await this.downloadJsonOutputs();

    // merging similarity, embeddings into framesegmentations results
    framesegmentations.forEach((frame, idx) => {
      frame.embeddings = embeddings[idx].embeddings;
      frame.similar_frames = similarity[idx].similar_frames;
    });

    TimecodeSettings = _setTimecodeSettings(segments);

    const technicalCues = [];
    const shotSegments = [];

    let startIdx = 0;
    segments.Segments
      .forEach((shotSegment) => {
        if (shotSegment.Type === 'TECHNICAL_CUE') {
          technicalCues.push(shotSegment);
        } else if (shotSegment.Type === 'SHOT') {
          const res = _findFramesInShotSegment(
            shotSegment,
            framesegmentations,
            startIdx
          );
          startIdx = res.nextIdx;
          shotSegment.Frames = res.frames;

          // find similar shots
          const similarShotSegments = _findSimilarShotSegments(
            res.frames,
            framesegmentations
          );
          shotSegment.SimilarShotSegments = similarShotSegments;
          shotSegments.push(shotSegment);
        }
      });

    let scenes = [];

    for (let i = 0; i < technicalCues.length; i += 1) {
      const {
        TechnicalCueSegment: {
          Type: technicalCueType,
        },
        ShotSegmentRange: shotSegmentRange,
        PartialShotSegment: isPartialShotSegment = false,
      } = technicalCues[i];

      if (technicalCueType === 'Content') {
        const _scenes = _scenesByContent(
          technicalCueType,
          shotSegmentRange,
          shotSegments,
          framesegmentations
        );

        _scenes.forEach((scene) => {
          scene.sceneNo = scenes.length;
          scenes.push(scene);
        });
      } else {
        let scene;

        if (isPartialShotSegment) {
          const technicalCueInShot = technicalCues[i];
          scene = _sceneByPartialTechncialCue(
            technicalCueInShot,
            shotSegments
          );
        } else {
          scene = _sceneByFixedTechincalCueType(
            technicalCueType,
            shotSegmentRange,
            shotSegments
          );
        }

        if (scene !== undefined) {
          // temporarily assign a scene no to the item
          scene.sceneNo = scenes.length;
          scenes.push(scene);
        }
      }
    }

    // also need to take care of segments that are not assigned to any technical cues
    if ((segments.UnknownSegments || []).length > 0) {
      scenes = _sceneByUnknownType(
        segments.UnknownSegments,
        shotSegments,
        scenes
      );
    }

    scenes
      .sort((a, b) =>
        a.timeStart - b.timeStart);

    // create webvtt track
    const track = new WebVttTrack();

    scenes.forEach((scene, idx) => {
      scene.sceneNo = idx;

      // make sure scene has a frame key
      if (scene.keyStart === undefined) {
        const frame = _scanFrameHashes(
          shotSegments[scene.shotStart],
          framehashes,
          SCAN_MODE.Forward
        );

        if (frame) {
          scene.keyStart = frame.name;
        } else {
          console.log(`[ERR]: scene#${idx}: Missing keyStart`);
        }
      }

      if (scene.keyEnd === undefined) {
        const frame = _scanFrameHashes(
          shotSegments[scene.shotEnd],
          framehashes,
          SCAN_MODE.Backward
        );

        if (frame) {
          scene.keyEnd = frame.name;
        } else {
          console.log(`[ERR]: scene#${idx}: Missing keyEnd`);
        }
      }

      // compute distances
      const [simStart, simEnd] = _computeSceneSimarility(scene, framesegmentations);
      scene.simStart = simStart;
      scene.simEnd = simEnd;

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
      console.log(`[scene#${String(scene.sceneNo).padStart(3, '0')}]: ${String(scene.shotStart).padStart(4, ' ')} - ${String(scene.shotEnd).padStart(4, ' ')}, ${_toHHMMSS(scene.timeStart)} -> ${_toHHMMSS(scene.timeEnd)} (${_toHHMMSS(scene.duration, true)}) [${scene.technicalCueType}] [FadeInOut = ${!!scene.fadeInBlack}, ${!!scene.fadeOutBlack}]`);
    });

    console.log(`== Total ${scenes.length} scenes dervied from ${shotSegments.length} shot segments`);

    const promises = [];

    const metadataPrefix = PATH.join(prefix, 'metadata', Scene);
    let metadata = {
      framePrefix,
      [Scene]: scenes,
    };

    // upload scene.json to metadata
    promises.push(CommonUtils.uploadFile(
      bucket,
      metadataPrefix,
      JSON_SCENE,
      metadata
    ).then(() =>
      PATH.join(metadataPrefix, JSON_SCENE)));

    const vttPrefix = PATH.join(prefix, 'vtt', Scene);
    let vtt = {
      [Scene]: track.toString(),
    };

    // upload scene.json to vtt
    promises.push(CommonUtils.uploadFile(
      bucket,
      vttPrefix,
      JSON_SCENE,
      vtt
    ).then(() =>
      PATH.join(vttPrefix, JSON_SCENE)));

    [metadata, vtt] = await Promise.all(promises);

    const data = this.stateData.data;
    const _embeddings = PATH.join(data[Scene].prefix, data[Scene].embeddings);
    const _similarity = PATH.join(data[Scene].prefix, data[Scene].similarity);
    const startTime = data[Scene].tsta;
    const filterSettings = data[Scene].filterSettings;

    // add scene output
    data[Scene] = {
      startTime,
      endTime: Date.now(),
      metadata,
      vtt,
      embeddings: _embeddings,
      similarity: _similarity,
      filterSettings,
    };

    delete data.embeddings;
    delete data.similarity;

    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async downloadJsonOutputs() {
    const {
      input: {
        destination: {
          bucket,
        },
      },
      data: {
        [Segment]: {
          output: segmentMapFile,
        },
        framesegmentation: {
          key: framesegmentationKey,
        },
        [Scene]: {
          prefix: similarityPrefix,
          similarity: similiarityOutput,
          embeddings: embeddingsOutput,
        },
      },
    } = this.stateData;

    const promises = [];

    // download segment output
    const mapFile = await CommonUtils.download(
      bucket,
      segmentMapFile
    ).then((res) =>
      JSON.parse(res));

    let segments = PATH.parse(segmentMapFile).dir;
    segments = PATH.join(segments, mapFile.file);
    segments = CommonUtils.download(
      bucket,
      segments
    ).then((res) =>
      JSON.parse(res));

    // download frame selection output
    let framesegmentations = CommonUtils.download(
      bucket,
      framesegmentationKey
    ).then((res) =>
      JSON.parse(res));

    // download similarity output
    let similarity = PATH.join(similarityPrefix, similiarityOutput);
    similarity = CommonUtils.download(
      bucket,
      similarity
    ).then((res) =>
      JSON.parse(res));

    // download embeddings output
    let embeddings = PATH.join(similarityPrefix, embeddingsOutput);
    embeddings = CommonUtils.download(
      bucket,
      embeddings
    ).then((res) =>
      JSON.parse(res));

    // download the frame hash output
    let framehashes = PATH.join(
      PATH.parse(framesegmentationKey).dir,
      JSON_FRAME_HASH
    );
    framehashes = CommonUtils.download(
      bucket,
      framehashes
    ).then((res) =>
      JSON.parse(res));

    promises.push(segments);
    promises.push(framesegmentations);
    promises.push(similarity);
    promises.push(embeddings);
    promises.push(framehashes);

    [
      segments, framesegmentations, similarity, embeddings, framehashes,
    ] = await Promise.all(promises);

    return {
      segments,
      framesegmentations,
      similarity,
      embeddings,
      framehashes,
    };
  }
}

function _setTimecodeSettings(segments) {
  const {
    VideoMetadata: [
      {
        FrameRate: frameRate,
      },
    ],
    Segments: [
      {
        StartTimecodeSMPTE: smpteTimecode,
      },
    ],
  } = segments;

  const enumFPS = framerateToEnum(frameRate);
  const dropFrame = !!(smpteTimecode.lastIndexOf(';') > 0);

  return {
    enumFPS,
    dropFrame,
  };
}

function _toHHMMSS(msec, withMsec) {
  return CommonUtils.toHHMMSS(msec, withMsec);
}

function _findFramesInShotSegment(
  shotSegment,
  framesegmentations,
  startIdx
) {
  const {
    ShotSegment: {
      Index: shotIdx,
    },
  } = shotSegment;

  const frames = [];

  let nextIdx = startIdx;
  for (nextIdx; nextIdx < framesegmentations.length; nextIdx += 1) {
    const frame = framesegmentations[nextIdx];

    if (frame.shotIdx < shotIdx) {
      continue;
    }

    if (frame.shotIdx > shotIdx) {
      break;
    }

    frame.idx = nextIdx;

    frames.push(frame);
  }

  return {
    frames,
    nextIdx,
  };
}

function _findSimilarFrames(
  frameIndices,
  framesegmentations
) {
  const processed = [];

  while (frameIndices.length) {
    const idx = frameIndices.shift();

    if (processed.includes(idx) === false) {
      processed.push(idx);

      const ts = framesegmentations[idx].timestamp;
      const similarFrames = framesegmentations[idx].similar_frames;

      for (let i = 0; i < similarFrames.length; i += 1) {
        if (similarFrames[i].D >= FilterSettings.minFrameSimilarity) {
          const _idx = similarFrames[i].I;
          if (!processed.includes(_idx) && !frameIndices.includes(_idx)) {
            const _ts = framesegmentations[_idx].timestamp;
            if (Math.abs(_ts - ts) <= FilterSettings.maxTimeDistance) {
              frameIndices.push(_idx);
            }
          }
        }
      }
    }
  }

  return processed;
}

function _findSimilarShotSegments(
  frames,
  framesegmentations
) {
  let framesByIndex = [];

  framesByIndex = frames
    .map((frame) =>
      frame.idx);

  framesByIndex = _findSimilarFrames(
    framesByIndex,
    framesegmentations
  );

  let shotIndices = framesByIndex
    .map((frameIdx) =>
      framesegmentations[frameIdx].shotIdx);

  shotIndices = [
    ...new Set(shotIndices),
  ];

  shotIndices
    .sort((a, b) =>
      a - b);

  return shotIndices;
}

function _sceneByFixedTechincalCueType(
  technicalCueType,
  shotSegmentRange,
  shotSegments
) {
  let scene;

  if (!shotSegmentRange) {
    return scene;
  }

  scene = _makeSceneItem(
    technicalCueType,
    shotSegments,
    shotSegmentRange
  );

  return scene;
}

function _scenesByContent(
  technicalCueType,
  shotSegmentRange,
  shotSegments,
  framesegmentations
) {
  let scenes = [];

  if (!shotSegmentRange) {
    return scenes;
  }

  const contentGroups = _splitContentByTransitions(
    shotSegments,
    shotSegmentRange
  );

  contentGroups.forEach((contentGroup) => {
    const indices = contentGroup
      .map((shotSegment) =>
        shotSegment.ShotSegment.Index);

    const min = Math.min(...indices);
    const max = Math.max(...indices);

    const scenesPerGroup = _scenesByContentGroup(
      technicalCueType,
      [min, max],
      shotSegments
    );

    if (scenesPerGroup.length > 0) {
      scenes = scenes.concat(scenesPerGroup);
    }
  });

  scenes = _sceneReduction(scenes, framesegmentations);

  return scenes;
}

function _sceneByUnknownType(
  shotIndices,
  shotSegments,
  scenes
) {
  if (shotIndices.length === 0) {
    return scenes;
  }

  shotIndices
    .sort((a, b) =>
      a - b);

  // make sure the unknown shot segment is not already covered by any scene
  let unknownScenes = [];

  shotIndices
    .forEach((shotIdx) => {
      const found = scenes
        .find((scene) =>
          shotIdx >= scene.shotStart && shotIdx <= scene.shotEnd);

      if (found === undefined) {
        const sceneItems = _makeSceneItems(
          'undefined',
          shotSegments,
          [shotIdx, shotIdx]
        );
        unknownScenes = unknownScenes.concat(sceneItems);
      }
    });

  if (unknownScenes.length >= 2) {
    const stack = [];
    stack.push(unknownScenes.shift());

    while (unknownScenes.length) {
      const prev = stack[stack.length - 1];
      const cur = unknownScenes[0];

      if (
        (prev.fadeOutBlack || cur.fadeInBlack) ||
        ((cur.shotStart - prev.shotEnd) > 1)
      ) {
        stack.push(cur);
      } else {
        // merge two scenes
        const item = _mergeScenes(prev, cur);
        stack.pop();
        stack.push(item);
      }

      unknownScenes.shift();
    }

    unknownScenes = stack;
  }

  console.log(`=== UNKNOWN SCENES [Before] (${unknownScenes.length}) ===`);

  unknownScenes.forEach((scene) => {
    console.log(`[scene#${String(scene.sceneNo).padStart(3, '0')}]: ${String(scene.shotStart).padStart(4, ' ')} - ${String(scene.shotEnd).padStart(4, ' ')}, ${scene.smpteStart} -> ${scene.smpteEnd} (${_toHHMMSS(scene.duration, true)}) [${scene.technicalCueType}] [FadeInOut = ${!!scene.fadeInBlack}, ${!!scene.fadeOutBlack}]`);
  });

  return scenes.concat(unknownScenes);
}

function _sceneByPartialTechncialCue(
  technicalCue,
  shotSegments
) {
  let scene;

  const {
    StartFrameNumber,
    StartTimestampMillis,
    StartTimecodeSMPTE,
    EndFrameNumber,
    EndTimestampMillis,
    EndTimecodeSMPTE,
    TechnicalCueSegment: {
      Type: technicalCueType,
    },
    ShotSegmentRange: shotSegmentRange,
  } = technicalCue;

  if (!shotSegmentRange) {
    return scene;
  }

  const [min, max] = shotSegmentRange;

  const {
    ShotSegment: {
      Index: shotIdx,
    },
  } = shotSegments[min];

  // fake a partial shot segment using technicalcue timestamps
  const partialShotSegment = {
    StartFrameNumber,
    StartTimestampMillis,
    StartTimecodeSMPTE,
    EndFrameNumber,
    EndTimestampMillis,
    EndTimecodeSMPTE,
    ShotSegment: {
      Index: shotIdx,
    },
    Frames: [],
  };

  scene = _makeSceneItem(
    technicalCueType,
    [partialShotSegment],
    [0, 0]
  );

  // scene.shotStart = shotSegmentRange[0];
  // scene.shotEnd = shotSegmentRange[0];

  return scene;
}

function _makeSceneItems(
  technicalCueType,
  shotSegments,
  range
) {
  const scenes = [];

  if (CUE_BREAKS.includes(technicalCueType)) {
    const scene = _makeSceneItem(
      technicalCueType,
      shotSegments,
      range
    );

    scenes.push(scene);

    return scenes;
  }

  let stack = [];
  const [min, max] = range;

  for (let i = min; i <= max; i += 1) {
    const cur = shotSegments[i];

    if (cur.TransitionBlack === undefined) {
      stack.push(cur);
      continue;
    }

    const [shotA, shotB] = _splitShotSegmentsByTransition(cur);

    if (shotA === undefined) {
      console.log(`[ERR]: fail to split transition shot:\n${JSON.stringify(cur, null, 2)}`);
      throw new M2CException('fail to split transition shot');
    }

    // end the scene with the transition
    stack.push(shotA);
    // create scene
    const scene = _makeSceneItem(
      technicalCueType,
      stack,
      [0, stack.length - 1]
    );
    scenes.push(scene);

    // reset the stack and start with the left over of the transition shot segment
    stack = [];
    if (shotB !== undefined) {
      stack.push(shotB);
    }
  }

  if (stack.length > 0) {
    // create scene
    const scene = _makeSceneItem(
      technicalCueType,
      stack,
      [0, stack.length - 1]
    );
    scenes.push(scene);
  }

  return scenes;
}

function _makeSceneItem(
  technicalCueType,
  shotSegments,
  range
) {
  const [min, max] = range;

  const {
    StartFrameNumber: frameStart,
    StartTimestampMillis: timeStart,
    StartTimecodeSMPTE: smpteStart,
    ShotSegment: {
      Index: shotStart,
    },
    Frames: shotMinFrames = [],
    FadeInBlack: fadeInBlack,
  } = shotSegments[min];
  const {
    EndFrameNumber: frameEnd,
    EndTimestampMillis: timeEnd,
    EndTimecodeSMPTE: smpteEnd,
    ShotSegment: {
      Index: shotEnd,
    },
    Frames: shotMaxFrames = [],
    FadeOutBlack: fadeOutBlack,
  } = shotSegments[max];

  const item = {
    sceneNo: -1,
    shotStart,
    frameStart,
    timeStart,
    smpteStart,
    keyStart: undefined,
    shotEnd,
    frameEnd,
    timeEnd,
    smpteEnd,
    keyEnd: undefined,
    duration: timeEnd - timeStart,
    technicalCueType,
    fadeInBlack,
    fadeOutBlack,
  };

  if (shotMinFrames.length > 0) {
    item.keyStart = shotMinFrames[0].name;
  }
  if (shotMaxFrames.length > 0) {
    item.keyEnd = shotMaxFrames[shotMaxFrames.length - 1].name;
  }

  return item;
}

function _scanShots(
  shotSegments,
  startIdx,
  mode,
  timeDistance
) {
  let prev = shotSegments[startIdx];

  if (mode === SCAN_MODE.Forward) {
    if (startIdx >= (shotSegments.length - 1)) {
      return prev.ShotSegment.Index;
    }

    if (prev.FadeOutBlack) {
      console.log(`[FadeOutBlack]: shot#${String(prev.ShotSegment.Index).padStart(4, '0')}`);
      return prev.ShotSegment.Index;
    }

    for (let i = startIdx + 1; i < shotSegments.length; i += 1) {
      const cur = shotSegments[i];

      if (cur.FadeOutBlack) {
        console.log(`[FadeOutBlack]: shot#${String(cur.ShotSegment.Index).padStart(4, '0')}`);
        return cur.ShotSegment.Index;
      }

      const _distance = cur.StartTimestampMillis - prev.EndTimestampMillis;
      if (_distance > timeDistance) {
        return prev.ShotSegment.Index;
      }
      prev = cur;
    }

    return prev.ShotSegment.Index;
  }

  if (startIdx === 0) {
    return prev.ShotSegment.Index;
  }

  if (prev.FadeInBlack) {
    console.log(`[FadeInBlack]: shot#${String(prev.ShotSegment.Index).padStart(4, '0')}`);
    return prev.ShotSegment.Index;
  }

  for (let i = startIdx - 1; i >= 0; i -= 1) {
    const cur = shotSegments[i];

    if (cur.FadeInBlack) {
      console.log(`[FadeInBlack]: shot#${String(cur.ShotSegment.Index).padStart(4, '0')}`);
      return cur.ShotSegment.Index;
    }

    const _distance = prev.StartTimestampMillis - cur.EndTimestampMillis;
    if (_distance > timeDistance) {
      return prev.ShotSegment.Index;
    }
    prev = cur;
  }

  return prev.ShotSegment.Index;
}

function _sceneReduction(scenes, framesegmentations) {
  if (scenes.length < 2) {
    return scenes;
  }

  scenes.sort((a, b) => {
    if (a.timeStart < b.timeStart) {
      return -1;
    }
    if (a.timeStart > b.timeStart) {
      return 1;
    }
    if (a.timeEnd < b.timeEnd) {
      return 1;
    }
    if (a.timeEnd > b.timeEnd) {
      return -1;
    }
    return 0;
  });

  let reduced = [];

  const sceneGroups = _splitSceneByTransitions(scenes);

  sceneGroups.forEach((sceneGroup) => {
    // merge overlapping scenes
    let _scenes = _mergeOverlapScenes(sceneGroup);

    // merge bursty scenes
    _scenes = _mergeShortScenes(_scenes, framesegmentations);
    reduced = reduced.concat(_scenes);
  });

  return reduced;
}

function _mergeOverlapScenes(scenes) {
  const _scenes = [];

  _scenes.push(scenes[0]);

  // merge overlapped scenes
  for (let i = 1; i < scenes.length; i += 1) {
    const prev = _scenes[_scenes.length - 1];
    const cur = scenes[i];

    if (cur.shotEnd < prev.shotStart) {
      throw new Error('Out of order. Should not happen!!!');
    }

    if (cur.shotStart > prev.shotStart && cur.shotEnd <= prev.shotEnd) {
      continue;
    }

    if (cur.shotStart > prev.shotEnd) {
      _scenes.push(cur);
      continue;
    }

    // merge scenes
    const merged = _mergeScenes(prev, cur);
    _scenes.pop();
    _scenes.push(merged);
  }

  return _scenes;
}

function _mergeShortScenes(scenes, framesegmentations) {
  if (scenes.length < 2) {
    return scenes;
  }

  const orig = scenes.length;

  console.log(`========= MergeShortScenes [BEFORE] ${orig} ===========`);
  scenes.forEach((scene) => {
    console.log(`[scene#${String(scene.sceneNo).padStart(3, '0')}]: ${String(scene.shotStart).padStart(4, ' ')} - ${String(scene.shotEnd).padStart(4, ' ')}, ${scene.smpteStart} -> ${scene.smpteEnd} (${_toHHMMSS(scene.duration, true)}) [${scene.technicalCueType}] [FadeInOut = ${!!scene.fadeInBlack}, ${!!scene.fadeOutBlack}]`);
  });

  const stack = [];
  stack.push(scenes.shift());

  while (scenes.length) {
    const prev = stack[stack.length - 1];
    const cur = scenes[0];
    const next = scenes[1];

    if (!next) {
      if (
        (!prev.fadeOutBlack && !cur.fadeInBlack) &&
        (prev.duration < BURST_DISTANCE || cur.duration < BURST_DISTANCE)
      ) {
        const merged = _mergeScenes(prev, cur);
        stack.pop();
        stack.push(merged);
      } else {
        stack.push(cur);
      }
      scenes.shift();
      continue;
    }

    if (prev.fadeOutBlack) {
      stack.push(cur);
      scenes.shift();
      continue;
    }

    if (cur.fadeInBlack) {
      stack.push(cur);
      scenes.shift();
      continue;
    }

    if (prev.duration < BURST_DISTANCE) {
      const merged = _mergeScenes(prev, cur);
      stack.pop();
      stack.push(merged);
      scenes.shift();
      continue;
    }

    if (cur.duration < BURST_DISTANCE) {
      if (prev.fadeInBlack) {
        const merged = _mergeScenes(prev, cur);
        stack.pop();
        stack.push(merged);
        scenes.shift();
        continue;
      }

      if (!next.fadeInBlack) {
        const merged = _mergeScenes(cur, next);
        stack.push(merged);
        scenes.shift();
        scenes.shift();
        continue;
      }
    }

    if (cur.shotStart === cur.shotEnd) {
      const [minA, maxA] = _computeShotSimilarity(
        framesegmentations,
        [prev.shotEnd, cur.shotStart]
      );

      const [minB, maxB] = _computeShotSimilarity(
        framesegmentations,
        [cur.shotEnd, next.shotStart]
      );

      let simA = minA;
      let simB = minB;

      // fine tune logic to select which simarility we should use
      if ((maxA > 0.80 || maxB > 0.80) || (minA < 0.60 && minB < 0.60)) {
        simA = maxA;
        simB = maxB;
      }

      const msg = `[Similarity][${cur.smpteStart} - ${cur.smpteEnd}]: [#${prev.shotEnd}] -> (${simA.toFixed(2)}) -> [#${cur.shotStart}] -> (${simB.toFixed(2)}) -> [#${next.shotStart}]`;

      // make sure the scene is similar enough to merge
      if (simA > simB && simA > 0.645) {
        const merged = _mergeScenes(prev, cur);
        stack.pop();
        stack.push(merged);
        scenes.shift();
        console.log(`${msg} [MERGE]`);
        continue;
      } else {
        console.log(`${msg} [NOT MERGE]`);
      }
    }

    stack.push(cur);
    scenes.shift();
  }

  console.log(`========= MergeShortScenes [AFTER] ${stack.length} ===========`);
  stack.forEach((scene) => {
    console.log(`[scene#${String(scene.sceneNo).padStart(3, '0')}]: ${String(scene.shotStart).padStart(4, ' ')} - ${String(scene.shotEnd).padStart(4, ' ')}, ${scene.smpteStart} -> ${scene.smpteEnd} (${_toHHMMSS(scene.duration, true)}) [${scene.technicalCueType}] [FadeInOut = ${!!scene.fadeInBlack}, ${!!scene.fadeOutBlack}]`);
  });

  console.log(`FINAL: ${orig} -> ${stack.length} (Reduced: ${orig - stack.length})`);

  return stack;
}

function _computeShotSimilarity(framesegmentation, range) {
  const [shotA, shotB] = range;

  if (shotA === shotB) {
    return [-1, -1];
  }

  let framesA;
  let framesB;

  [framesA, framesB] = _getFramesByShotIndex(
    framesegmentation,
    [shotA, shotB]
  );

  // try to find the next adjacent shot
  if (framesA.length === 0 && framesB.length === 0) {
    [framesA, framesB] = _getFramesByShotIndex(
      framesegmentation,
      [shotA - 1, shotB + 1]
    );
  } else if (framesA.length === 0) {
    [framesA] = _getFramesByShotIndex(
      framesegmentation,
      [shotA - 1]
    );
  } else if (framesB.length === 0) {
    [framesB] = _getFramesByShotIndex(
      framesegmentation,
      [shotB + 1]
    );
  }

  if (framesA.length === 0 || framesB.length === 0) {
    return [-1, -1];
  }

  const similarities = [];

  framesA.forEach((frameA) => {
    framesB.forEach((frameB) => {
      similarities.push(
        _cosineSimarlity(frameA.embeddings, frameB.embeddings)
      );
    });
  });

  const min = Math.min(...similarities);
  const max = Math.max(...similarities);

  return [min, max];
}

function _getFramesByShotIndex(framesegmentation, indices) {
  const len = framesegmentation.length;

  const min = Math.max(
    Math.min(...indices),
    0
  );

  const max = Math.min(
    Math.max(...indices),
    len - 1
  );

  const frameArrays = indices
    .map((x) =>
      ([]));

  let _min = Math.min(min, len - 1);

  for (_min; _min >= 0; _min -= 1) {
    const frame = framesegmentation[_min];
    if (frame.shotIdx < min) {
      break;
    }
  }

  for (let i = _min; i < len; i += 1) {
    const frame = framesegmentation[i];

    if (frame === undefined) {
      continue;
    }

    if (frame.shotIdx < min) {
      continue;
    }

    if (frame.shotIdx > max) {
      break;
    }

    const idx = indices.findIndex((x) =>
      x === frame.shotIdx);

    if (idx >= 0) {
      frameArrays[idx].push(frame);
    }
  }

  return frameArrays;
}

function _cosineSimarlity(arrayA, arrayB) {
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

  return dotProduct / (meanA * meanB);
}

function _mergeScenes(prev, cur) {
  const {
    sceneNo,
    shotStart,
    frameStart,
    timeStart,
    smpteStart,
    keyStart,
    technicalCueType,
    fadeInBlack,
  } = prev;
  const {
    shotEnd,
    frameEnd,
    timeEnd,
    smpteEnd,
    keyEnd,
    fadeOutBlack,
  } = cur;

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
    fadeInBlack,
    fadeOutBlack,
  };
  merged.duration = timeEnd - timeStart;

  return merged;
}

function _scanFrameHashes(shotSegment, framehashes, mode) {
  const {
    FrameRange: range = [],
  } = shotSegment;

  const [min, max] = range;

  if (
    ((framehashes || []).length === 0) ||
    (typeof min === 'undefined') ||
    (typeof max === 'undefined')
  ) {
    return undefined;
  }

  if (mode === SCAN_MODE.Forward) {
    for (let i = min; i <= max; i += 1) {
      if (framehashes[i] !== undefined) {
        return framehashes[i];
      }
    }
  } else {
    for (let i = max; i >= min; i -= 1) {
      if (framehashes[i] !== undefined) {
        return framehashes[i];
      }
    }
  }

  return undefined;
}

function _splitContentByTransitions(shotSegments, shotSegmentRange = []) {
  const contentGroups = [];

  const [min, max] = shotSegmentRange;
  if (typeof min !== 'number' || typeof max !== 'number') {
    return contentGroups;
  }

  let stack = [];

  for (let i = min; i <= max; i += 1) {
    const shotSegment = shotSegments[i];

    if (shotSegment.FadeInBlack) {
      if (stack.length > 0) {
        contentGroups.push(stack);
        stack = [];
      }
    }

    if (shotSegment.FadeOutBlack) {
      stack.push(shotSegment);
      contentGroups.push(stack);
      stack = [];
      continue;
    }

    stack.push(shotSegment);
  }

  if (stack.length > 0) {
    contentGroups.push(stack);
  }

  return contentGroups;
}

function _scenesByContentGroup(
  technicalCueType,
  shotSegmentRange,
  shotSegments
) {
  const [min, max] = shotSegmentRange;

  let curIdx = min;
  let scenes = [];

  while (curIdx <= max) {
    const related = [curIdx];
    const shotSegment = shotSegments[curIdx];

    shotSegment.SimilarShotSegments
      .forEach((idx) => {
        if (
          (idx >= curIdx) &&
          (idx <= max) &&
          (!related.includes(idx))
        ) {
          related.push(idx);
        }
      });

    related.sort((a, b) =>
      a - b);

    const similarShotSegments = [];
    related.forEach((idx) => {
      similarShotSegments.push(shotSegments[idx]);
    });

    const _min = curIdx;
    const _max = _scanShots(
      similarShotSegments,
      0,
      SCAN_MODE.Forward,
      FilterSettings.maxTimeDistance
    );

    const sceneItems = _makeSceneItems(
      technicalCueType,
      shotSegments,
      [_min, _max]
    );
    scenes = scenes.concat(sceneItems);

    curIdx = _max + 1;
  }

  return scenes;
}

function _splitSceneByTransitions(scenes) {
  const sceneGroups = [];
  let stack = [];

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];

    if (scene.fadeInBlack) {
      if (stack.length > 0) {
        sceneGroups.push(stack);
        stack = [];
      }
    }

    if (scene.fadeOutBlack) {
      stack.push(scene);
      sceneGroups.push(stack);
      stack = [];
      continue;
    }

    stack.push(scene);
  }

  if (stack.length > 0) {
    sceneGroups.push(stack);
  }

  return sceneGroups;
}

function _setFilterSettings(userFilterSettings = {}) {
  let {
    minFrameSimilarity,
    maxTimeDistance,
  } = userFilterSettings;

  minFrameSimilarity = Number(minFrameSimilarity);
  maxTimeDistance = Number(maxTimeDistance);

  if (
    (!Number.isNaN(minFrameSimilarity)) &&
    minFrameSimilarity >= 0.0 &&
    minFrameSimilarity < 1.0
  ) {
    FilterSettings.minFrameSimilarity = minFrameSimilarity;
  }

  if (
    (!Number.isNaN(maxTimeDistance)) &&
    maxTimeDistance >= ONE_MIN &&
    maxTimeDistance <= TEN_MINS
  ) {
    FilterSettings.maxTimeDistance = maxTimeDistance;
  }
}

function _splitShotSegmentsByTransition(shotSegment) {
  if (TimecodeSettings.enumFPS === undefined) {
    throw new M2CException('invalid TimecodeSettings');
  }

  const transitionSegments = [];

  const {
    StartFrameNumber: frameStart,
    StartTimestampMillis: timeStart,
    StartTimecodeSMPTE: smpteStart,
    EndFrameNumber: frameEnd,
    EndTimestampMillis: timeEnd,
    EndTimecodeSMPTE: smpteEnd,
    Frames: shotFrames = [],
    TransitionBlack: {
      TimestampMillis: transitionTimestamp,
      FrameNumber: transitionFrameNumber,
      TimecodeSMPTE: transitionTimecode,
    },
    ShotSegment: {
      Index: shotIdx,
    },
  } = shotSegment;

  let frames = shotFrames
    .filter((frame) =>
      frame.timestamp <= transitionTimestamp);

  const transitionA = {
    StartFrameNumber: frameStart,
    StartTimestampMillis: timeStart,
    StartTimecodeSMPTE: smpteStart,
    EndFrameNumber: transitionFrameNumber,
    EndTimestampMillis: transitionTimestamp,
    EndTimecodeSMPTE: transitionTimecode,
    ShotSegment: {
      Index: shotIdx,
    },
    Frames: frames,
    FadeOutBlack: true,
  };
  transitionSegments.push(transitionA);

  if (
    (transitionTimestamp > timeStart) &&
    (transitionTimestamp < timeEnd)
  ) {
    const {
      enumFPS,
      dropFrame,
    } = TimecodeSettings;

    const _frameStart = transitionFrameNumber + 1;
    const _timeStart = framesToMilliseconds(
      enumFPS,
      _frameStart
    );
    const [_smpteStart, hhmmssff] = toTimecode(
      enumFPS,
      fromTimecode(enumFPS, transitionTimecode) + 1,
      dropFrame
    );

    frames = shotFrames
      .filter((frame) =>
        frame.timestamp > transitionTimestamp);

    const transitionB = {
      StartFrameNumber: _frameStart,
      StartTimestampMillis: _timeStart,
      StartTimecodeSMPTE: _smpteStart,
      EndFrameNumber: frameEnd,
      EndTimestampMillis: timeEnd,
      EndTimecodeSMPTE: smpteEnd,
      ShotSegment: {
        Index: shotIdx,
      },
      Frames: frames,
      FadeInBlack: true,
    };
    transitionSegments.push(transitionB);
  }

  if (transitionSegments.length > 1) {
    console.log(`[Splitting ShotSegment]: shot#${String(shotIdx).padStart(4, '0')} [${smpteStart} - ${smpteEnd}] -> A: [${transitionSegments[0].StartTimecodeSMPTE} - ${transitionSegments[0].EndTimecodeSMPTE}], B: [${transitionSegments[1].StartTimecodeSMPTE} - ${transitionSegments[1].EndTimecodeSMPTE}]`);
  }

  return transitionSegments;
}

function _computeSceneSimarility(scene, framesegmentations) {
  const simStart = _computeShotSimilarity(
    framesegmentations,
    [scene.shotStart - 1, scene.shotStart]
  );

  const simEnd = _computeShotSimilarity(
    framesegmentations,
    [scene.shotEnd, scene.shotEnd + 1]
  );

  return [
    simStart,
    simEnd,
  ];
}

module.exports = StateCreateSceneEvents;
