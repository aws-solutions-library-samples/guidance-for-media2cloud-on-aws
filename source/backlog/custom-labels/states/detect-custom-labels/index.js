// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const PATH = require('path');
const {
  BacklogClient: {
    CustomBacklogJob,
  },
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
    S3: {
      ExpectedBucketOwner,
    },
  },
  xraysdkHelper,
  retryStrategyHelper,
} = require('service-backlog-lib');
const RekogHelper = require('../shared/rekogHelper');
const BaseState = require('../shared/baseState');

const FRAMECAPTURE_PREFIX = 'frame';
const STATUS_COMPLETED = 'completed';
const STATUS_PROCESSING = 'processing';
const DATA_FILENAME = '00000000.json';

class StateDetectCustomLabels extends BaseState {
  get [Symbol.toStringTag]() {
    return 'StateDetectCustomLabels';
  }

  async process() {
    const output = await this.detectCustomLabels();
    this.setOutput(BaseState.States.DetectCustomLabels, output);
    return super.process();
  }

  async detectCustomLabels() {
    const src = this.input;
    const numFrames = src.frameCapture.numFrames;
    const curState = this.output[BaseState.States.DetectCustomLabels] || {};
    let cursor = curState.cursor || 0;
    let batchRecords = [];
    while (cursor < numFrames && !this.quitNow()) {
      let responses = await this.batchDetectCustomLabels(cursor);
      cursor += responses.length;
      responses = responses.reduce((a0, c0) =>
        a0.concat(c0), []);
      batchRecords = batchRecords.concat(responses);
    }

    const dataset = {
      Bucket: src.bucket,
      Prefix: src.frameCapture.prefix,
      CustomLabels: batchRecords,
    };
    await this.updateDataFile(
      this.output.bucket,
      this.output.prefix,
      DATA_FILENAME,
      dataset
    );

    let status = STATUS_PROCESSING;
    if (cursor >= numFrames) {
      status = STATUS_COMPLETED;
      cursor = 0;
    } else {
      await this.updateProjectVersionTTL();
    }

    return {
      output: PATH.join(this.output.prefix, DATA_FILENAME),
      projectVersionArn: this.projectVersionArn,
      status,
      numFrames,
      cursor,
      numOutputs: 1,
    };
  }

  async batchDetectCustomLabels(cursor) {
    const input = this.input;
    const numFrames = input.frameCapture.numFrames;
    const inferenceUnits = this.output[BaseState.States.CheckProjectVersionStatus].inferenceUnits;
    const promises = [];
    let idx = cursor;
    for (let i = 0; i < inferenceUnits; i++) {
      if (idx < numFrames) {
        const [
          frameNumber,
          timestamp,
        ] = this.computeFrameNumAndTimestamp(idx, input.framerate, input.frameCapture);
        const name = `${FRAMECAPTURE_PREFIX}.${idx.toString().padStart(7, '0')}.jpg`;
        promises.push(RekogHelper.detectCustomLabels({
          ProjectVersionArn: this.projectVersionArn,
          Image: {
            S3Object: {
              Bucket: input.bucket,
              // eslint-disable-next-line
              // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
              Name: PATH.join(input.frameCapture.prefix, name),
            },
          },
        }).then(data =>
          data.CustomLabels.map(x => ({
            Image: name,
            FrameNumber: frameNumber,
            Timestamp: timestamp,
            CustomLabel: {
              ...x,
            },
          })))
          .catch((e) => {
            console.error(`ERR: ${name} ${e.message}`);
            return [
              {
                Image: name,
                FrameNumber: frameNumber,
                Timestamp: timestamp,
                CustomLabel: {
                  ErrorMessage: e.message,
                },
              },
            ];
          }));
        idx++;
      }
    }
    return Promise.all(promises);
  }

  async updateDataFile(
    bucket,
    prefix,
    name,
    dataset
  ) {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, name);

    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    let command;
    command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner,
    });

    let merged = await s3Client.send(command)
      .catch(() =>
        undefined);

    if (merged && merged.Body) {
      merged = JSON.parse(await merged.Body.transformToString());
      merged.CustomLabels = merged.CustomLabels
        .concat(dataset.CustomLabels);
    } else {
      merged = dataset;
    }

    merged = JSON.stringify(merged);

    command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: merged,
      ContentType: 'application/json',
      ContentDisposition: `attachment; filename="${name}"`,
      ServerSideEncryption: 'AES256',
      ExpectedBucketOwner,
    });

    return s3Client.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  async updateProjectVersionTTL() {
    return CustomBacklogJob.updateTTL(this.projectVersionArn, 15 * 60)
      .catch(() => undefined);
  }

  computeFrameNumAndTimestamp(second, framerate, frameCapture) {
    const num = Math.round(
      (second * framerate * frameCapture.denominator) / frameCapture.numerator
    );
    return [
      num,
      Math.round((num * 1000) / framerate),
    ];
  }
}

module.exports = StateDetectCustomLabels;
