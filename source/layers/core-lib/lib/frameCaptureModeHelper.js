// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const FrameCaptureMode = require('./frameCaptureMode');

class FrameCaptureModeHelper {
  static suggestFrameCaptureRate(srcFramerate, frameCaptureMode) {
    const framerate = Number(srcFramerate);
    if (Number.isNaN(framerate)) {
      return [];
    }
    if (Object.values(FrameCaptureMode).indexOf(frameCaptureMode) < 0
    || frameCaptureMode === FrameCaptureMode.MODE_NONE) {
      return [];
    }

    let numerator;
    let denominator;
    switch (frameCaptureMode) {
      case FrameCaptureMode.MODE_1FPS:
      case FrameCaptureMode.MODE_2FPS:
      case FrameCaptureMode.MODE_3FPS:
      case FrameCaptureMode.MODE_4FPS:
      case FrameCaptureMode.MODE_5FPS:
      case FrameCaptureMode.MODE_10FPS:
      case FrameCaptureMode.MODE_12FPS:
      case FrameCaptureMode.MODE_15FPS:
        numerator = frameCaptureMode;
        denominator = 1;
        break;
      case FrameCaptureMode.MODE_ALL:
        numerator = Math.round(framerate);
        denominator = (numerator === framerate)
          ? 1000
          : 1001;
        numerator *= 1000;
        break;
      case FrameCaptureMode.MODE_HALF_FPS:
        numerator = Math.round(framerate);
        denominator = (numerator === framerate)
          ? 1000
          : 1001;
        numerator *= (1000 / 2);
        break;
      case FrameCaptureMode.MODE_1F_EVERY_2S:
        denominator = 10;
        numerator = denominator / 2;
        break;
      case FrameCaptureMode.MODE_1F_EVERY_5S:
        denominator = 10;
        numerator = denominator / 5;
        break;
      case FrameCaptureMode.MODE_1F_EVERY_10S:
        denominator = 10;
        numerator = denominator / 10;
        break;
      case FrameCaptureMode.MODE_1F_EVERY_30S:
        denominator = 30;
        numerator = 1;
        break;
      case FrameCaptureMode.MODE_1F_EVERY_1MIN:
        denominator = 1 * 60;
        numerator = 1;
        break;
      case FrameCaptureMode.MODE_1F_EVERY_2MIN:
        denominator = 2 * 60;
        numerator = 1;
        break;
      case FrameCaptureMode.MODE_1F_EVERY_5MIN:
        denominator = 5 * 60;
        numerator = 1;
        break;
      case FrameCaptureMode.MODE_DYNAMIC_FPS:
        numerator = 1;
        denominator = 1;
        break;
      default:
        numerator = 0;
    }
    if (!numerator || !denominator) {
      return [];
    }
    return [
      numerator,
      denominator,
    ];
  }

  static computeFrameNumAndTimestamp(
    second,
    framerate,
    frameCapture
  ) {
    const num = Math.round(
      (second * framerate * frameCapture.denominator) / frameCapture.numerator
    );
    return [
      num,
      Math.round((num * 1000) / framerate),
    ];
  }
}

module.exports = FrameCaptureModeHelper;
