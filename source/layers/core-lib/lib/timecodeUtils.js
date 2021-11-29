// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const EnumFrameRate = Object.freeze({
  FPS_23_976: Symbol('23.976'),
  FPS_24: Symbol('24'),
  FPS_25: Symbol('25'),
  FPS_29_97: Symbol('29.97'),
  FPS_30: Symbol('30'),
  FPS_59_94: Symbol('59.94'),
  FPS_60: Symbol('60'),
});

// https://www.davidheidelberger.com/2010/06/10/drop-frame-timecode/
class TimecodeUtils {
  constructor(enumFPS, dropFrame = false) {
    this.$enumFPS = enumFPS;
    this.$dropFrame = dropFrame
      && (enumFPS === EnumFrameRate.FPS_23_976
        || enumFPS === EnumFrameRate.FPS_29_97
        || enumFPS === EnumFrameRate.FPS_59_94);
    this.$framerateFraction = TimecodeUtils.lookupFramerate(enumFPS);
  }

  get enumFPS() {
    return this.$enumFPS;
  }

  get dropFrame() {
    return this.$dropFrame;
  }

  get framerateFraction() {
    return this.$framerateFraction;
  }

  static get Enum() {
    return {
      Framerate: EnumFrameRate,
    };
  }

  static lookupFramerate(enumFPS) {
    return enumFPS === EnumFrameRate.FPS_23_976
      ? [24000, 1001]
      : enumFPS === EnumFrameRate.FPS_24
        ? [24000, 1000]
        : enumFPS === EnumFrameRate.FPS_25
          ? [25000, 1000]
          : enumFPS === EnumFrameRate.FPS_29_97
            ? [30000, 1001]
            : enumFPS === EnumFrameRate.FPS_30
              ? [30000, 1000]
              : enumFPS === EnumFrameRate.FPS_59_94
                ? [60000, 1001]
                : enumFPS === EnumFrameRate.FPS_60
                  ? [60000, 1000]
                  : undefined;
  }

  toTimecode(num) {
    return this.dropFrame
      ? this.enumFPS === EnumFrameRate.FPS_23_976
        ? this.toPseudoDropFrameTimecode(num)
        : this.toDropFrameTimecode(num)
      : this.toNonDropFrameTimecode(num);
  }

  toNonDropFrameTimecode(num) {
    if (!this.framerateFraction) {
      throw new Error(`${this.enumFPS.toString()} not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    const timeBase = Math.floor(framerate);
    const framesPerHour = timeBase * 60 * 60;
    const framesPer24Hours = framesPerHour * 24;

    let frameNumber = num;
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

    return [
      hours,
      minutes,
      seconds,
      frames,
    ];
  }

  // 29.97 or 59.94 DF
  toDropFrameTimecode(num) {
    if (this.enumFPS !== EnumFrameRate.FPS_29_97 && this.enumFPS !== EnumFrameRate.FPS_59_94) {
      throw new Error(`${this.enumFPS.toString()} Drop Frame not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    // frames to drop on the minute mark.
    const dropFrames = Math.round(framerate * 0.066666);
    const framesPerMinute = Math.round(framerate * 60) - dropFrames;
    const framesPer10Minutes = Math.round(framerate * 60 * 10);
    const framesPerHour = Math.round(framerate * 60 * 60);
    const framesPer24Hours = framesPerHour * 24;

    let frameNumber = num;
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
    const minutes = Math.floor(Math.floor(frameNumber / frRound) / 60) % 60;
    const hours = Math.floor(Math.floor(Math.floor(frameNumber / frRound) / 60) / 60);

    return [
      hours,
      minutes,
      seconds,
      frames,
    ];
  }

  // 23.976
  toPseudoDropFrameTimecode(num) {
    if (this.enumFPS !== EnumFrameRate.FPS_23_976) {
      throw new Error(`${this.enumFPS.toString()} Drop Frame not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    const secondsDecimal = num / framerate;
    let secondsInt = Math.floor(secondsDecimal);
    const secondsDecimalPart = secondsDecimal - secondsInt;

    let frames = Math.round(secondsDecimalPart * framerate);
    if (frames === 24) {
      frames = 0;
      secondsInt += 1;
    }

    let remainingSeconds = secondsInt;
    const hours = Math.floor(remainingSeconds / (60 * 60));
    remainingSeconds -= (hours * 60 * 60);
    const minutes = Math.floor(remainingSeconds / 60);
    remainingSeconds -= (minutes * 60);
    const seconds = remainingSeconds;

    return [
      hours,
      minutes,
      seconds,
      frames,
    ];
  }

  fromTimecode(hours, minutes, seconds, frames) {
    return this.dropFrame
      ? this.enumFPS === EnumFrameRate.FPS_23_976
        ? this.fromPseudoDropFrameTimecode(hours, minutes, seconds, frames)
        : this.fromDropFrameTimecode(hours, minutes, seconds, frames)
      : this.fromNonDropFrameTimecode(hours, minutes, seconds, frames);
  }

  fromNonDropFrameTimecode(hours, minutes, seconds, frames) {
    if (!this.framerateFraction) {
      throw new Error(`${this.enumFPS.toString()} not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    const timeBase = Math.round(framerate);
    const hourFrames = timeBase * 60 * 60;
    const minuteFrames = timeBase * 60;
    const frameNumber = (hourFrames * hours)
      + (minuteFrames * minutes)
      + (timeBase * seconds)
      + frames;
    return frameNumber;
  }

  // 29.97 and 59.94
  fromDropFrameTimecode(hours, minutes, seconds, frames) {
    if (this.enumFPS !== EnumFrameRate.FPS_29_97 && this.enumFPS !== EnumFrameRate.FPS_59_94) {
      throw new Error(`${this.enumFPS.toString()} Drop Frame not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    const dropFrames = Math.round(framerate * 0.066666);
    const timeBase = Math.round(framerate);
    const hourFrames = timeBase * 60 * 60;
    const minuteFrames = timeBase * 60;
    const totalMinutes = (60 * hours) + minutes;
    const frameNumber = ((hourFrames * hours)
      + (minuteFrames * minutes)
      + (timeBase * seconds)
      + frames)
      - (dropFrames * (totalMinutes - Math.floor(totalMinutes / 10)));
    return frameNumber;
  }

  // 23.976
  fromPseudoDropFrameTimecode(hours, minutes, seconds, frames) {
    if (this.enumFPS !== EnumFrameRate.FPS_23_976) {
      throw new Error(`${this.enumFPS.toString()} Drop Frame not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    const hourFrames = framerate * 60 * 60;
    const minuteFrames = framerate * 60;
    const framesDouble = (hours * hourFrames)
      + (minutes * minuteFrames)
      + (seconds * framerate)
      + frames;
    const frameNumber = Math.round(framesDouble);
    return frameNumber;
  }

  toTimestamp(num) {
    if (!this.framerateFraction) {
      throw new Error(`${this.enumFPS.toString()} not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    let milliseconds = Math.round(num * framerate * 1000);
    const hours = Math.floor(milliseconds / 3600 / 1000);
    milliseconds -= (hours * 3600 * 1000);
    const minutes = Math.floor(milliseconds / 60 / 1000);
    milliseconds -= (minutes * 60 * 1000);
    const seconds = Math.floor(milliseconds / 1000);
    milliseconds -= (seconds * 1000);

    return [
      hours,
      minutes,
      seconds,
      milliseconds,
    ];
  }

  fromMilliseconds(msecs) {
    if (!this.framerateFraction) {
      throw new Error(`${this.enumFPS.toString()} not supported`);
    }
    const framerate = this.framerateFraction[0] / this.framerateFraction[1];
    const frameNumber = Math.floor((framerate * msecs) / 1000);
    return frameNumber;
  }
}

module.exports = TimecodeUtils;
