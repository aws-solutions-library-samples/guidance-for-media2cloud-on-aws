// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const THRESHOLD_LAMBDA_TIMEOUT = 60 * 1000;

class BaseState {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;

    this.$stateData = event;
    if ((event.stateExecution || {}).Input !== undefined) {
      this.$stateData = event.stateExecution.Input;
    }

    let fn = () =>
      THRESHOLD_LAMBDA_TIMEOUT * 2;
    if (typeof (context || {}).getRemainingTimeInMillis === 'function') {
      fn = context.getRemainingTimeInMillis;
    }
    this.$fnGetRemainingTime = fn.bind();
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    return this.stateData;
  }

  lambdaTimeout() {
    const remainingTime = this.$fnGetRemainingTime();
    return (remainingTime - THRESHOLD_LAMBDA_TIMEOUT) <= 0;
  }

  static opSupported(op) {
    return false;
  }
}

module.exports = BaseState;
