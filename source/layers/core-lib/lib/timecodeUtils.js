// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  M2CException,
} = require('./error');

const EnumFrameRate = Object.freeze({
  FPS_23_976: Symbol('23.976'),
  FPS_24: Symbol('24'),
  FPS_25: Symbol('25'),
  FPS_29_97: Symbol('29.97'),
  FPS_30: Symbol('30'),
  FPS_50: Symbol('50'),
  FPS_59_94: Symbol('59.94'),
  FPS_60: Symbol('60'),
});

function _lookupFramerate(enumFPS) {
  if (enumFPS === EnumFrameRate.FPS_23_976) {
    return [24000, 1001];
  }
  if (enumFPS === EnumFrameRate.FPS_24) {
    return [24000, 1000];
  }
  if (enumFPS === EnumFrameRate.FPS_25) {
    return [25000, 1000];
  }
  if (enumFPS === EnumFrameRate.FPS_29_97) {
    return [30000, 1001];
  }
  if (enumFPS === EnumFrameRate.FPS_30) {
    return [30000, 1000];
  }
  if (enumFPS === EnumFrameRate.FPS_50) {
    return [50000, 1000];
  }
  if (enumFPS === EnumFrameRate.FPS_59_94) {
    return [60000, 1001];
  }
  if (enumFPS === EnumFrameRate.FPS_60) {
    return [60000, 1000];
  }

  throw new M2CException('invalid framerate enum');
}

// https://www.davidheidelberger.com/2010/06/10/drop-frame-timecode/
class TimecodeUtils {
  static get EnumFPS() {
    return EnumFrameRate;
  }

  // convert fps to enum
  static framerateToEnum(framerate) {
    const _framerate = Math.floor(framerate);

    if (_framerate === 23) {
      return EnumFrameRate.FPS_23_976;
    }
    if (_framerate === 24) {
      return EnumFrameRate.FPS_24;
    }
    if (_framerate === 25) {
      return EnumFrameRate.FPS_25;
    }
    if (_framerate === 29) {
      return EnumFrameRate.FPS_29_97;
    }
    if (_framerate === 30) {
      return EnumFrameRate.FPS_30;
    }
    if (_framerate === 50) {
      return EnumFrameRate.FPS_50;
    }
    if (_framerate === 59) {
      return EnumFrameRate.FPS_59_94;
    }
    if (_framerate === 60) {
      return EnumFrameRate.FPS_60;
    }

    throw new M2CException('invalid framerate');
  }

  // Drop Frame timecode (29.97 or 59.94)
  static fromDropFrameTimecode(enumFPS, hhmmssff) {
    if (
      (enumFPS !== EnumFrameRate.FPS_29_97) &&
      (enumFPS !== EnumFrameRate.FPS_59_94)
    ) {
      throw new M2CException(`${enumFPS.toString()} Drop Frame not supported`);
    }

    const [numerator, denominator] = _lookupFramerate(enumFPS);
    const framerate = numerator / denominator;

    const dropFrames = Math.round(framerate * 0.066666);
    const timeBase = Math.round(framerate);
    const hourFrames = timeBase * 60 * 60;
    const minuteFrames = timeBase * 60;

    const [hours, minutes, seconds, frames] = hhmmssff;
    const totalMinutes = (60 * hours) + minutes;
    const frameNumber = ((hourFrames * hours)
      + (minuteFrames * minutes)
      + (timeBase * seconds)
      + frames)
      - (dropFrames * (totalMinutes - Math.floor(totalMinutes / 10)));

    return frameNumber;
  }

  static toDropFrameTimecode(enumFPS, frameNum) {
    if (
      (enumFPS !== EnumFrameRate.FPS_29_97) &&
      (enumFPS !== EnumFrameRate.FPS_59_94)
    ) {
      throw new M2CException(`${enumFPS.toString()} Drop Frame not supported`);
    }
    const [numerator, denominator] = _lookupFramerate(enumFPS);
    const framerate = numerator / denominator;

    // frames to drop on the minute mark.
    const dropFrames = Math.round(framerate * 0.066666);

    const framesPerMinute = Math.round(framerate * 60) - dropFrames;
    const framesPer10Minutes = Math.round(framerate * 60 * 10);
    const framesPerHour = Math.round(framerate * 60 * 60);
    const framesPer24Hours = framesPerHour * 24;

    let frameNumber = frameNum;
    while (frameNumber < 0) {
      frameNumber += framesPer24Hours;
    }
    frameNumber %= framesPer24Hours;
    const d = Math.floor(frameNumber / framesPer10Minutes);
    const m = frameNumber % framesPer10Minutes;

    if (m > dropFrames) {
      frameNumber = frameNumber
        + (dropFrames * 9 * d)
        + (dropFrames * Math.floor((m - dropFrames) / framesPerMinute));
    } else {
      frameNumber += (dropFrames * 9 * d);
    }

    const frRound = Math.round(framerate);
    const frames = frameNumber % frRound;
    const seconds = Math.floor(frameNumber / frRound) % 60;
    const minutes = Math.floor(
      Math.floor(frameNumber / frRound) / 60
    ) % 60;
    const hours = Math.floor(
      Math.floor(
        Math.floor(frameNumber / frRound) / 60
      ) / 60
    );

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const ff = String(frames).padStart(2, '0');

    return [
      `${hh}:${mm}:${ss};${ff}`,
      [hours, minutes, seconds, frames],
    ];
  }

  // Non-Drop Frame timecode
  static fromNonDropFrameTimecode(enumFPS, hhmmssff) {
    let _enumFPS = enumFPS;
    if (enumFPS === EnumFrameRate.FPS_23_976) {
      _enumFPS = EnumFrameRate.FPS_24;
    }

    const [numerator, denominator] = _lookupFramerate(_enumFPS);
    const framerate = numerator / denominator;

    const timeBase = Math.round(framerate);
    const hourFrames = timeBase * 60 * 60;
    const minuteFrames = timeBase * 60;

    const [hours, minutes, seconds, frames] = hhmmssff;
    const frameNumber = (hourFrames * hours)
      + (minuteFrames * minutes)
      + (timeBase * seconds)
      + frames;

    return frameNumber;
  }

  static toNonDropFrameTimecode(enumFPS, frameNum) {
    // 23.976 uses 24 timing
    let _enumFPS = enumFPS;
    if (_enumFPS === EnumFrameRate.FPS_23_976) {
      _enumFPS = EnumFrameRate.FPS_24;
    }

    const [numerator, denominator] = _lookupFramerate(_enumFPS);

    const framerate = numerator / denominator;
    const timeBase = Math.floor(framerate);
    const framesPerHour = timeBase * 60 * 60;
    const framesPer24Hours = framesPerHour * 24;

    let frameNumber = frameNum;
    while (frameNumber < 0) {
      frameNumber += framesPer24Hours;
    }
    frameNumber %= framesPer24Hours;

    let remaningFrames = frameNumber;
    const hourFrames = timeBase * 60 * 60;
    const minuteFrames = timeBase * 60;

    const hours = Math.floor(remaningFrames / hourFrames);
    remaningFrames -= (hours * hourFrames);

    const minutes = Math.floor(remaningFrames / minuteFrames);
    remaningFrames -= (minutes * minuteFrames);

    const seconds = Math.floor(remaningFrames / timeBase);
    const frames = remaningFrames - (seconds * timeBase);

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const ff = String(frames).padStart(2, '0');

    return [
      `${hh}:${mm}:${ss}:${ff}`,
      [hours, minutes, seconds, frames],
    ];
  }

  static fromTimecode(enumFPS, timecodeString) {
    if (!timecodeString) {
      throw new M2CException('invalid timecode string');
    }

    let hhmmssff = timecodeString.split(':');
    if (hhmmssff.length === 4) {
      hhmmssff = hhmmssff
        .map((x) =>
          Number(x));

      return TimecodeUtils.fromNonDropFrameTimecode(
        enumFPS,
        hhmmssff
      );
    }

    if (hhmmssff.length === 3) {
      const ssff = hhmmssff.pop().split(';');
      hhmmssff = hhmmssff.concat(ssff)
        .map((x) =>
          Number(x));

      return TimecodeUtils.fromDropFrameTimecode(
        enumFPS,
        hhmmssff
      );
    }

    throw new M2CException('invalid timecode string');
  }

  static toTimecode(enumFPS, frameNum, dropFrame = false) {
    if (dropFrame) {
      return TimecodeUtils.toDropFrameTimecode(enumFPS, frameNum);
    }
    return TimecodeUtils.toNonDropFrameTimecode(enumFPS, frameNum);
  }

  // Timestamp
  static toTimestamp(enumFPS, frameNum) {
    const [numerator, denominator] = _lookupFramerate(enumFPS);

    let milliseconds = Math.round(
      (frameNum * denominator * 1000) / numerator
    );

    const hours = Math.floor(milliseconds / 3600000);
    milliseconds -= (hours * 3600000);

    const minutes = Math.floor(milliseconds / 60000);
    milliseconds -= (minutes * 60000);

    const seconds = Math.floor(milliseconds / 1000);
    milliseconds -= (seconds * 1000);

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const msecs = String(milliseconds).padStart(3, '0');

    return [
      `${hh}:${mm}:${ss}.${msecs}`,
      [hours, minutes, seconds, milliseconds],
    ];
  }

  static millisecondsToFrames(enumFPS, milliseconds) {
    const [numerator, denominator] = _lookupFramerate(enumFPS);
    const frameNumber = Math.round(
      ((milliseconds * numerator) / denominator) / 1000
    );

    return frameNumber;
  }

  static secondsToFrames(enumFPS, seconds) {
    return TimecodeUtils.millisecondsToFrames(enumFPS, seconds * 1000);
  }

  static framesToMilliseconds(enumFPS, frameNum) {
    const [numerator, denominator] = _lookupFramerate(enumFPS);

    const milliseconds = Math.round(
      (frameNum * denominator * 1000) / numerator
    );

    return milliseconds;
  }

  static framesToSeconds(enumFPS, frameNum) {
    const milliseconds = TimecodeUtils.framesToMilliseconds(
      enumFPS,
      frameNum
    );

    return milliseconds / 1000;
  }
}

module.exports = TimecodeUtils;
