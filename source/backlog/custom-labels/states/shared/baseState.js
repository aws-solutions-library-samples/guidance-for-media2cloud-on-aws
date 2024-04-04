// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  Environment: {
    StateMachines: {
      States,
    },
  },
  M2CException,
} = require('service-backlog-lib');

const LAMBDA_TIMEOUT_THRESHOLD = 60 * 1000;

class BaseState {
  constructor(event, context) {
    this.$t0 = new Date().getTime();
    this.$event = event;
    this.$context = context;
    this.$accountId = context.invokedFunctionArn.split(':')[4];
    this.$region = process.env.AWS_REGION || context.invokedFunctionArn.split(':')[3];
    this.$fnGetRemainingTime = (typeof context.getRemainingTimeInMillis === 'function')
      ? context.getRemainingTimeInMillis.bind()
      : undefined;
    this.sanityCheck();
  }

  sanityCheck() {
    if (!this.operation) {
      throw new M2CException('missing operation');
    }
    const input = this.input;
    if (!input
      || !input.bucket
      || typeof input.duration !== 'number'
      || typeof input.framerate !== 'number'
      || !this.testProjectArn(input.projectArn)
      || !this.testProjectVersionArn(input.projectVersionArn)
      /* checking frameCapture structure */
      || !input.frameCapture
      || !input.frameCapture.prefix
      || typeof input.frameCapture.numFrames !== 'number'
      || typeof input.frameCapture.numerator !== 'number'
      || typeof input.frameCapture.denominator !== 'number') {
      throw new M2CException('missing or invalid input parameter(s)');
    }
    const output = this.output;
    if (!output
      || !output.bucket
      || !output.prefix) {
      throw new M2CException('missing or invalid output parameter(s)');
    }
  }

  static get States() {
    return States;
  }

  get t0() {
    return this.$t0;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get accountId() {
    return this.$accountId;
  }

  get jobTag() {
    return this.$event.jobTag;
  }

  get operation() {
    return this.$event.operation;
  }

  get input() {
    return this.$event.input;
  }

  set input(val) {
    this.$event.input = JSON.parse(JSON.stringify(val));
  }

  get output() {
    return this.$event.output;
  }

  set output(val) {
    this.$event.output = JSON.parse(JSON.stringify(val));
  }

  get projectArn() {
    return this.input.projectArn;
  }

  get projectVersionArn() {
    return this.input.projectVersionArn;
  }

  get inferenceUnits() {
    return this.input.inferenceUnits;
  }

  toJSON() {
    return this.event;
  }

  getRemainingTime() {
    return this.$fnGetRemainingTime
      ? this.$fnGetRemainingTime()
      : 900000; // 15 mins
  }

  quitNow() {
    return (this.getRemainingTime() - LAMBDA_TIMEOUT_THRESHOLD) <= 0;
  }

  makeOutputPath(ref, subPath = '') {
    const parsed = PATH.parse(ref);
    const compatibleName = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '');
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(parsed.dir, compatibleName, subPath);
  }

  setOutput(state, data) {
    this.output[state] = {
      ...this.output[state],
      ...data,
      metrics: {
        t0: ((this.output[state] || {}).metrics || {}).t0 || this.t0,
        t1: new Date().getTime(),
      },
    };
  }

  testProjectArn(val) {
    return /^arn:[a-z\d-]+:rekognition:[a-z\d-]+:\d{12}:project\/[a-zA-Z0-9_.-]{1,255}\/[0-9]+$/.test(val);
  }

  testProjectVersionArn(val) {
    return /^arn:[a-z\d-]+:rekognition:[a-z\d-]+:\d{12}:project\/[a-zA-Z0-9_.-]{1,255}\/version\/[a-zA-Z0-9_.-]{1,255}\/[0-9]+$/.test(val);
  }

  async process() {
    return this.toJSON();
  }
}

module.exports = BaseState;
