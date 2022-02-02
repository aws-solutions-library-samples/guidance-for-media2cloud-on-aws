// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const PATH = require('path');
const {
  Retry,
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
} = require('service-backlog-lib');
const RekogHelper = require('../shared/rekogHelper');
const BaseState = require('../shared/baseState');

const FRAMECAPTURE_PREFIX = 'frame';
const STATUS_COMPLETED = 'completed';
const STATUS_PROCESSING = 'processing';
const MAX_RECORDS_PER_JSON = 1000;

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
    let numOutputs = curState.numOutputs || 0;
    const batchRecords = [];
    while (cursor < numFrames && !this.quitNow()) {
      let responses = await this.batchDetectCustomLabels(cursor);
      cursor += responses.length;
      responses = responses.reduce((a0, c0) =>
        a0.concat(...c0), []);
      batchRecords.splice(batchRecords.length, 0, ...responses);
      if (batchRecords.length > MAX_RECORDS_PER_JSON) {
        await this.uploadBatchRecords(numOutputs, batchRecords);
        batchRecords.length = 0;
        numOutputs++;
      }
    }
    const status = (cursor >= numFrames)
      ? STATUS_COMPLETED
      : STATUS_PROCESSING;
    if (batchRecords.length) {
      await this.uploadBatchRecords(numOutputs, batchRecords);
      numOutputs++;
    }
    if (status === STATUS_PROCESSING) {
      await this.updateProjectVersionTTL();
    } else {
      cursor = 0;
    }
    return {
      output: this.output.prefix,
      projectVersionArn: this.projectVersionArn,
      status,
      numFrames,
      cursor,
      numOutputs,
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

  async uploadBatchRecords(idx, batches) {
    const bucket = this.output.bucket;
    const prefix = this.output.prefix;
    const name = `${idx.toString().padStart(8, '0')}.json`;
    const body = {
      Bucket: this.input.bucket,
      Prefix: this.input.frameCapture.prefix,
      CustomLabels: batches,
    };
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: CustomUserAgent,
    });
    const params = {
      Bucket: bucket,
      Key: PATH.join(prefix, name),
      Body: JSON.stringify(body, null, 2),
      ContentType: 'application/json',
      ContentDisposition: `attachment; filename="${name}"`,
      ServerSideEncryption: 'AES256',
      ExpectedBucketOwner,
    };
    const fn = s3.putObject.bind(s3);
    return Retry.run(fn, params);
  }

  async updateProjectVersionTTL() {
    return CustomBacklogJob.updateTTL(this.projectVersionArn, 15 * 60)
      .catch(() => undefined);
  }

  computeFrameNumAndTimestamp(idx, framerate, frameCapture) {
    const num = Math.round((idx * framerate * frameCapture.denominator) / frameCapture.numerator);
    return [
      num,
      Math.round((num / framerate) * 1000),
    ];
  }
}

module.exports = StateDetectCustomLabels;
