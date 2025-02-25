// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  JimpHelper: {
    ignoreKnownHashes,
    compareHashes,
  },
} = require('core-lib');

// ColorBars | EndCredits | BlackFrames | OpeningCredits | StudioLogo | Slate | Content
const TYPE_STEADY = ['ColorBars', 'BlackFrames', 'StudioLogo', 'Slate'];
const TYPE_CREDITS = ['EndCredits'];
const TYPE_OPENING = ['OpeningCredits'];
const TYPE_CONTENT = ['Content', 'undefined'];
const HAMMING_DISTANCE_THRESHOLD = 0.250;
const SPLIT_INTERVAL = 2 * 60 * 1000; // 2min
const SAMPLING_INTERVAL = 4 * 1000; // 4s
const SCAN_MODE = {
  Forward: 0,
  Backward: 1,
};
const USE_SUBGROUPING = true;

class SelectionHelper {
  static selectFrames(frameHashes, segments) {
    let selected = [];

    if (segments !== undefined) {
      selected = _withShotSegment(frameHashes, segments);
    } else {
      selected = _withHammingDistance(frameHashes);
    }

    console.log(`selectFrames: selected ${selected.length} out of ${frameHashes.length} frames. ${((selected.length / frameHashes.length) * 100).toFixed(2)}%`);
    return selected;
  }
}

function _withShotSegment(frameHashes, segments) {
  const technicalCues = [];
  const shotSegments = [];

  // split technical cues and shots
  segments.Segments
    .forEach((segment) => {
      if (segment.Type === 'TECHNICAL_CUE') {
        technicalCues.push(segment);
      } else if (segment.Type === 'SHOT') {
        shotSegments.push(segment);
      }
    });

  // special case: potentially short form video. Fake the technicalCue.
  if (technicalCues.length === 0) {
    shotSegments.forEach((shotSegment) => {
      technicalCues.push({
        ShotSegmentRange: [shotSegment.ShotSegment.Index, shotSegment.ShotSegment.Index],
        TechnicalCueSegment: {
          Type: 'undefined',
        },
      });
    });
  }

  let selected = [];
  let shotIdx = 0;

  for (let i = 0; i < technicalCues.length; i += 1) {
    const technicalCue = technicalCues[i];

    if (technicalCue.ShotSegmentRange && !technicalCue.PartialShotSegment) {
      const [min, max] = technicalCue.ShotSegmentRange;

      while (shotIdx < shotSegments.length) {
        const shotSegment = shotSegments[shotIdx];

        if (shotSegment.ShotSegment.Index > max) {
          break;
        }

        if (shotSegment.ShotSegment.Index < min) {
          shotIdx += 1;
          continue;
        }

        const selectedFrames = _selectFromShotSegment(
          shotSegment,
          frameHashes,
          technicalCue.TechnicalCueSegment.Type
        );

        if (selectedFrames.length > 0) {
          selected = selected
            .concat(selectedFrames);
        }

        shotIdx += 1;
      }
    }
  }

  // special case: unknown type shot segments
  if ((segments.UnknownSegments || []).length > 0) {
    console.log(`[INFO]: found ${segments.UnknownSegments.length} unknown shot segments.`);

    segments.UnknownSegments
      .forEach((idx) => {
        const shotSegment = shotSegments
          .find((x) =>
            x.ShotSegment.Index === idx);

        if (shotSegment) {
          const extra = _selectFromUnknownShotSegment(
            shotSegment,
            frameHashes
          );

          if (extra.length > 0) {
            selected = selected.concat(extra);
          }
        }
      });
  }

  selected
    .sort((a, b) =>
      a.timestamp - b.timestamp);

  return selected;
}

function _withHammingDistance(frameHashes) {
  let selected = [];

  if (frameHashes.length === 0) {
    selected = [];
  } else if (frameHashes.length < 2) {
    selected = _selectByLaplacian(frameHashes, 1);
  } else {
    const interval = frameHashes[1].timestamp - frameHashes[0].timestamp;
    const numItems = Math.floor(SPLIT_INTERVAL / interval);
    const maxFrames = Math.max(
      Math.round(SPLIT_INTERVAL / SAMPLING_INTERVAL),
      1
    );

    while (frameHashes.length > 0) {
      const frames = frameHashes
        .splice(0, numItems);

      const scanned = _selectByScanning(frames, maxFrames);

      selected = selected
        .concat(scanned);
    }
  }

  return selected;
}

function _selectFromShotSegment(
  shotSegment,
  frameHashes,
  technicalCueType
) {
  const {
    StartTimestampMillis: ssta,
    EndTimestampMillis: send,
    ShotSegment: {
      Index: shotIdx,
    },
    FrameRange: frameRange,
  } = shotSegment;

  const shotSegmentFrames = _framesInRange(frameHashes, frameRange);

  let selected = [];

  // #1: too short of the segment, skip frame
  // #2: short segment or irrelevant type such as BlackFrames, return 1 frame only
  // #3: for end credits, fixed rate of 3s
  // #4: content / opening
  if (shotSegmentFrames.length < 2) {
    selected = _selectAtmostOne(shotSegmentFrames);
  } else if (TYPE_STEADY.includes(technicalCueType)) {
    selected = _selectByLaplacian(shotSegmentFrames, 1);
  } else if (TYPE_CREDITS.includes(technicalCueType)) {
    selected = _selectByFixedRate(shotSegmentFrames, SAMPLING_INTERVAL);
  } else if (TYPE_OPENING.includes(technicalCueType) || TYPE_CONTENT.includes(technicalCueType)) {
    // budget frames to atmost 1 frame every 3 seconds
    const maxFrames = Math.max(Math.round((send - ssta) / SAMPLING_INTERVAL), 1);
    selected = _selectByScanning(shotSegmentFrames, maxFrames);
  } else {
    console.log(`[INFO]: [#${shotIdx}]: ${technicalCueType}: not supported`);
  }

  selected
    .forEach((x) => {
      x.shotIdx = shotIdx;
      x.technicalCueType = technicalCueType;
    });

  return selected;
}

function _selectFromUnknownShotSegment(
  shotSegment,
  frameHashes
) {
  const {
    StartTimestampMillis: ssta,
    EndTimestampMillis: send,
    ShotSegment: {
      Index: shotIdx,
    },
    FrameRange: frameRange,
  } = shotSegment;

  const shotSegmentFrames = _framesInRange(frameHashes, frameRange);

  const maxFrames = Math.max(
    Math.round((send - ssta) / SAMPLING_INTERVAL),
    1
  );

  const selected = _selectByScanning(shotSegmentFrames, maxFrames);

  selected
    .forEach((x) => {
      x.shotIdx = shotIdx;
      x.technicalCueType = 'undefined';
    });

  return selected;
}

function _framesInRange(frameHashes, range = []) {
  const frames = [];

  const [min, max] = range;
  if (
    (typeof min !== 'undefined') &&
    (typeof max !== 'undefined')
  ) {
    for (let i = min; i <= max; i += 1) {
      const frame = frameHashes[i];

      if (frame !== undefined) {
        frames.push(frame);
      }
    }
  }

  return frames;
}

function _selectAtmostOne(frames) {
  if (frames.length) {
    return [frames[0]];
  }
  return [];
}

function _selectByFixedRate(frames, sampling = SAMPLING_INTERVAL) {
  if (frames.length === 0) {
    return [];
  }

  if (frames.length < 2) {
    return [
      frames[0],
    ];
  }

  const selected = [];

  let prev = frames[0];
  selected.push(prev);

  for (let i = 1; i < frames.length; i += 1) {
    const cur = frames[i];

    if ((cur.timestamp - prev.timestamp) >= sampling) {
      selected.push(cur);
      prev = cur;
    }
  }

  return selected;
}

function _selectByLaplacian(frames, numItems = 1) {
  frames
    .sort((a, b) =>
      b.laplacian - a.laplacian);

  return frames.splice(0, numItems);
}

function _selectByScanning(frames, maxFrames) {
  if (USE_SUBGROUPING) {
    return _selectBySubGrouping(frames, maxFrames);
  }
  return _selectAndPrioritizeBoundaryFrames(frames, maxFrames);
}

function _selectBySubGrouping(frames, maxFrames) {
  const numFrames = frames.length;
  const selectedByGroups = [];

  if (frames.length === 0) {
    return selectedByGroups;
  }

  const groups = _groupFrames(frames);
  for (const subGroup of groups) {
    if (subGroup.length === 0) {
      throw new Error('No item in subGroup. LOGIC ERROR');
    }

    const frameA = subGroup[0];
    const frameB = subGroup[subGroup.length - 1];
    if (subGroup.length > 1) {
      frameA.extendFrameDuration = frameB.timestamp - frameA.timestamp;
    }
    selectedByGroups.push(frameA);
  }

  // special case where a shot has just two frames and both are being selected.
  if (frames.length === 2 && selectedByGroups.length === 2) {
    const [frameA, frameB] = selectedByGroups;
    frameA.extendFrameDuration = frameB.timestamp - frameA.timestamp;
    selectedByGroups.pop();
  }

  console.log(`[selectByScanning][ByGrouping]: ${numFrames} -> ${selectedByGroups.length}  [dropping ${numFrames - selectedByGroups.length} frames]`);

  return selectedByGroups;
}

function _groupFrames(frames) {
  const groups = [];

  if (frames.length === 0) {
    return groups;
  }

  if (frames.length === 1) {
    groups.push([frames[0]]);
    return groups;
  }

  let curGroup = [];
  curGroup.push(frames[0]);

  for (let i = 1; i < frames.length; i += 1) {
    const pre = curGroup[curGroup.length - 1];
    const cur = frames[i];
    const d = _compareHash(pre.hash, cur.hash);
    cur.distanceToPreviousFrame = d;

    if (d > HAMMING_DISTANCE_THRESHOLD) {
      groups.push(curGroup);
      curGroup = [cur];
      continue;
    }
    curGroup.push(cur);
  }

  if (curGroup.length > 0) {
    groups.push(curGroup);
  }

  return groups;
}

function _selectAndPrioritizeBoundaryFrames(frames, maxFrames) {
  const numFrames = frames.length;

  let boundaryFrames = [];

  if (frames.length === 0) {
    return boundaryFrames;
  }

  // collect frames at the boundary
  boundaryFrames.push(frames.shift());
  if (frames.length > 1) {
    boundaryFrames.push(frames.pop());
  }

  if (frames.length <= 2) {
    return boundaryFrames;
  }

  const extraFrames = maxFrames - 2;
  if (extraFrames <= 0) {
    return boundaryFrames;
  }

  // scan from the boundary frames
  let scanned = _scanByReference(frames, boundaryFrames[0], SCAN_MODE.Forward);

  // frame reduction
  scanned = _frameReduction(scanned, boundaryFrames, extraFrames);
  scanned = scanned.concat(boundaryFrames)
    .sort((a, b) =>
      a.timestamp - b.timestamp);

  console.log(`[SelectAndPrioritizeBoundaryFrames]:  ${numFrames} -> ${scanned.length} [dropping ${numFrames - scanned.length} frames]`);

  return scanned;
}

function _scanByReference(frames, refFrame, mode, distance = HAMMING_DISTANCE_THRESHOLD) {
  let filtered = 0;
  let cur = refFrame;
  const selected = [];

  if (mode === SCAN_MODE.Forward) {
    for (const frame of frames) {
      const d = _compareHash(cur.hash, frame.hash);
      if (d > distance) {
        selected.push(frame);
        cur = frame;
      } else {
        filtered += 1;
      }
    }

    console.log(`ScanR: ${filtered} frames filtered and ${selected.length} frames selected from ${frames.length} frames.`);
    return selected;
  }

  // scan backward
  const len = frames.length;
  for (let i = len - 1; i >= 0; i -= 1) {
    const frame = frames[i];
    const d = _compareHash(cur.hash, frame.hash);
    if (d > distance) {
      selected.push(frame);
      cur = frame;
    } else {
      filtered += 1;
    }
  }

  console.log(`ScanL: ${filtered} frames filtered and ${selected.length} frames selected from ${frames.length} frames.`);
  return selected;
}

function _frameReduction(candidates, boundaryFrames, maxFrames, distance = HAMMING_DISTANCE_THRESHOLD) {
  let filtered = [];

  // compare candidates with boundary frames
  for (const frame of candidates) {
    let qualified = true;
    for (const frameB of boundaryFrames) {
      const d = _compareHash(frame.hash, frameB.hash);
      if (d < distance) {
        qualified = false;
        break;
      }
    }

    if (qualified) {
      filtered.push(frame);
    }
  }

  // over max. frames, drop based on frame's details
  if (filtered.length > maxFrames) {
    filtered.sort((a, b) =>
      b.laplacian - a.laplacian);

    filtered = filtered.slice(0, maxFrames);
  }

  return filtered;
}

function _compareHash(hash1, hash2) {
  if (
    (typeof hash1 === 'undefined') ||
    (typeof hash2 === 'undefined')
  ) {
    return 0;
  }

  // ignore blackframe and EBU colorbars
  if (ignoreKnownHashes(hash2)) {
    return 0;
  }

  const d = compareHashes(hash1, hash2);
  return d;
}

module.exports = SelectionHelper;
