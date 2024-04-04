// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
} = require('core-lib');
const SelectionHelper = require('./selectionHelper');

const FRAMESEGMENTATION = 'framesegmentation';
const FRAMECAPTURE_OUTPUT_GROUP = 'frameCapture';
const JSON_FRAME_HASH = 'frameHash.json';
const JSON_FRAMESEGMENTATION = `${FRAMESEGMENTATION}.json`;

class StateSelectSegmentFrames {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;

    const {
      input: {
        aiOptions: {
          filters = {},
        },
      },
    } = stateData;
    _setFilterSettings(filters[FRAMESEGMENTATION]);
  }

  get [Symbol.toStringTag]() {
    return 'StateSelectSegmentFrames';
  }

  get stateData() {
    return this.$stateData;
  }

  async downloadShotSegments() {
    const {
      input: {
        destination: {
          bucket,
        },
      },
      data: {
        segment,
      },
    } = this.stateData;

    if ((segment || {}).output === undefined) {
      return undefined;
    }

    let mapFile = segment.output;
    mapFile = await CommonUtils.download(bucket, mapFile)
      .then((res) =>
        JSON.parse(res));

    const prefix = PATH.parse(segment.output).dir;
    const segments = PATH.join(prefix, mapFile.file);

    return CommonUtils.download(bucket, segments)
      .then((res) =>
        JSON.parse(res));
  }

  async downloadFrameHashJson() {
    const {
      input: {
        destination: {
          bucket,
        },
        video: {
          key: videoKey,
        },
      },
    } = this.stateData;

    const prefix = PATH.join(
      PATH.parse(videoKey).dir,
      '..',
      FRAMECAPTURE_OUTPUT_GROUP
    );
    const frameHashes = PATH.join(prefix, JSON_FRAME_HASH);

    return CommonUtils.download(bucket, frameHashes)
      .then((res) =>
        JSON.parse(res));
  }

  async process() {
    try {
      const t0 = Date.now();

      const promises = [];

      promises.push(this.downloadFrameHashJson());
      // optional shot segment results
      promises.push(this.downloadShotSegments()
        .catch(() =>
          undefined));

      const [
        frameHashes,
        segments,
      ] = await Promise.all(promises);

      const framesExtracted = frameHashes.length;

      const frameSegmentation = SelectionHelper.selectFrames(
        frameHashes,
        segments
      );

      console.log(`[INFO]: StateSelectSegmentFrames.process: ${frameSegmentation.length} out of ${framesExtracted}`);

      const {
        input: {
          destination: {
            bucket,
          },
          video: {
            key: videoKey,
          },
        },
        data,
      } = this.stateData;

      const prefix = PATH.join(
        PATH.parse(videoKey).dir,
        '..',
        FRAMECAPTURE_OUTPUT_GROUP
      );

      await CommonUtils.uploadFile(
        bucket,
        prefix,
        JSON_FRAMESEGMENTATION,
        frameSegmentation
      );

      data[FRAMESEGMENTATION] = {
        startTime: t0,
        endTime: Date.now(),
        key: PATH.join(prefix, JSON_FRAMESEGMENTATION),
        framesExtracted,
        framesAnalyzed: frameSegmentation.length,
      };

      this.stateData.setCompleted();

      return this.stateData;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}

function _setFilterSettings(userFilterSettings) {
  return undefined;
}

module.exports = StateSelectSegmentFrames;
