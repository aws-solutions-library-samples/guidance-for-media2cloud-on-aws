// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const OS = require('os');
const PATH = require('path');
const {
  Worker,
  SHARE_ENV,
} = require('worker_threads');
const {
  CommonUtils,
  StateData,
  FrameCaptureModeHelper,
  TranscodeError,
  JimpHelper: {
    imageFromS3,
    computeHash,
    computeLaplacianVariance,
  },
} = require('core-lib');

const WORKER_JS = 'worker.js';

const FRAMECAPTURE_OUTPUT_GROUP = 'frameCapture';
const FRAME_HASH_JSON = 'frameHash.json';

class StateComputePerceptualHash {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new TranscodeError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateComputePerceptualHash';
  }

  get stateData() {
    return this.$stateData;
  }

  async downloadFrameHashOutput(bucket, prefix, name) {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, name);
    let data = await CommonUtils.download(bucket, key)
      .then((res) =>
        JSON.parse(res))
      .catch(() =>
        undefined);

    if (data === undefined) {
      data = await this.createFrameHashOutput(bucket, prefix, name);
    }

    return data;
  }

  async createFrameHashOutput(bucket, prefix, name) {
    const data = [];

    // get numerator and denominator
    const input = this.stateData.input;
    const fps = input.framerate;
    const mode = input.aiOptions.frameCaptureMode;
    const [
      numerator,
      denominator,
    ] = FrameCaptureModeHelper.suggestFrameCaptureRate(fps, mode);
    const captureFPS = {
      numerator,
      denominator,
    };

    let response;
    do {
      const params = {
        ContinuationToken: (response || {}).NextContinuationToken,
        MaxKeys: 1000,
      };

      response = await CommonUtils.listObjects(bucket, prefix, params);

      response.Contents
        .forEach((x) => {
          if (/\.jpg$/.test(x.Key) === false) {
            return;
          }
          // extract the frame index
          const bname = PATH.parse(x.Key).base;
          const matched = bname.match(/frame\.([0-9]+)\.jpg/);
          if (matched) {
            const frameIdx = Number(matched[1]);
            const [
              frameNo,
              timestamp,
            ] = FrameCaptureModeHelper.computeFrameNumAndTimestamp(
              frameIdx,
              fps,
              captureFPS
            );

            data.push({
              name: bname,
              frameNo,
              timestamp,
            });
          }
        });
    } while ((response || {}).NextContinuationToken);

    data.sort((a, b) =>
      a.frameNo - b.frameNo);

    await CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      data
    );

    return data;
  }

  async createWorkerThread(
    idx,
    threads,
    data,
    frameHashes
  ) {
    const remaining = this.stateData.getRemainingTime();
    const bufferTime = 60 * 1000;
    const curTime = Date.now();
    const deadline = curTime + (remaining - bufferTime);

    return new Promise((resolve, reject) => {
      console.log(`WorkerThread #${idx}`);

      const parsed = PATH.parse(__filename);
      const file = PATH.join(parsed.dir, WORKER_JS);

      const worker = new Worker(file, {
        env: SHARE_ENV,
        workerData: {
          ...data,
          startIdx: idx,
          step: threads,
          deadline,
        },
      });

      worker.on('message', (message) => {
        // update frameHashes
        if (message.idx !== undefined && message.hash !== undefined) {
          frameHashes[message.idx].hash = message.hash;
          frameHashes[message.idx].laplacian = message.laplacian;
          /*
          console.log(
            'worker.on.message',
            'tid:',
            idx,
            JSON.stringify(message)
          );
          */
        } else if (message.error) {
          console.error(
            'ERR:',
            'tid:',
            idx,
            message.error
          );
        }
      });

      worker.on('error', (e) => {
        console.log(`[ERR]: WorkerThread #${idx}: ${e.code} ${e.message}`);
        reject(e);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.log(`[ERR]: WorkerThread #${idx}: exitCode: ${code}`);
          reject(new Error(`exitCode ${code}`));
          return;
        }
        console.log(`WorkerThread #${idx} [RETURNED]`);
        resolve();
      });
    });
  }

  async spawnWorkerThreads(
    params,
    frameHashes
  ) {
    const cpus = OS.cpus();
    const num = cpus.length;

    const workerResponses = await Promise.all(cpus
      .map((_, idx) =>
        this.createWorkerThread(
          idx,
          num,
          params,
          frameHashes
        )));

    return workerResponses;
  }

  async computeImageProps(bucket, prefix, frameHashes) {
    const filtered = frameHashes
      .filter((x) =>
        x.hash === undefined);

    for (let i = 0; i < filtered.length; i += 1) {
      const item = filtered[i];
      // eslint-disable-next-line
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
      const key = PATH.join(prefix, item.name);

      let hash = 'undefined';
      let laplacian = 0;

      const image = await imageFromS3(bucket, key)
        .catch((e) => {
          console.error(
            'ERR:',
            'JimpHelper:imageFromS3',
            e.message
          );
          return undefined;
        });

      if (image) {
        [
          hash,
          laplacian,
        ] = await Promise.all([
          computeHash(image),
          computeLaplacianVariance(image),
        ]);
      }

      item.hash = hash;
      item.laplacian = laplacian;

      if (this.stateData.quitNow()) {
        break;
      }
    }
  }

  async process() {
    const input = this.stateData.input;
    const data = this.stateData.data;
    const bucket = input.destination.bucket;
    const prefix = PATH.join(data.transcode.output, FRAMECAPTURE_OUTPUT_GROUP, '/');
    const name = FRAME_HASH_JSON;

    const frameHashes = await this.downloadFrameHashOutput(bucket, prefix, name);

    let unprocessed = frameHashes
      .reduce((a0, c0) => {
        if (c0.hash === undefined) {
          return a0 + 1;
        }
        return a0;
      }, 0);

    if (unprocessed === 0) {
      this.stateData.setCompleted();
      return this.stateData;
    }

    if (unprocessed > 100) {
      const params = {
        bucket,
        prefix,
        name,
      };

      await this.spawnWorkerThreads(
        params,
        frameHashes
      );
    } else {
      await this.computeImageProps(bucket, prefix, frameHashes);
    }

    // update new hash results to S3
    await CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      frameHashes
    );
    this.stateData.data.transcode.frameHash = PATH.join(prefix, name);

    unprocessed = frameHashes
      .reduce((a0, c0) => {
        if (c0.hash === undefined) {
          return a0 + 1;
        }
        return a0;
      }, 0);

    if (unprocessed > 0) {
      let percentage = (frameHashes.length - unprocessed) / frameHashes.length;
      percentage = Math.round(percentage * 100);
      this.stateData.setProgress(percentage);
    } else {
      this.stateData.setCompleted();
    }

    return this.stateData;
  }
}

module.exports = StateComputePerceptualHash;
