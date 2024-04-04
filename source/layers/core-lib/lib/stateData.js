// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const StateMessage = require('./stateMessage');
const CommonUtils = require('./commonUtils');

/**
 * @class StateData
 * @description simple wrapper class to handle input/ouput data with this state machine
 */
class StateData extends StateMessage {
  constructor(stateMachine, event, context) {
    super({
      stateMachine,
      uuid: event.uuid || (event.input || {}).uuid,
      operation: event.operation,
      status: event.status,
      progress: event.progress,
    });

    this.$input = event.input
      ? {
        ...event.input,
      }
      : undefined;

    this.$output = event.$output
      ? {
        ...event.output,
      }
      : undefined;

    this.$data = event.data
      ? {
        ...event.data,
      }
      : undefined;

    this.$event = {
      ...event,
    };

    this.$context = context;

    this.$accountId = context.invokedFunctionArn.split(':')[4];
    const fn = (typeof context.getRemainingTimeInMillis === 'function')
      ? context.getRemainingTimeInMillis
      : () => StateData.Constants.LambdaTimeoutThreshold * 2;
    this.$fnGetRemainingTime = fn.bind();
  }

  get [Symbol.toStringTag]() {
    return 'StateData';
  }

  static get Constants() {
    return {
      LambdaTimeoutThreshold: 60 * 1000,
    };
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

  get input() {
    return this.$input;
  }

  set input(val) {
    this.$input = (typeof val !== 'object')
      ? val
      : {
        ...this.$input,
        ...val,
      };
  }

  get output() {
    return this.$output;
  }

  set output(val) {
    this.$output = (typeof val !== 'object')
      ? val
      : {
        ...this.$output,
        ...val,
      };
  }

  get data() {
    return this.$data;
  }

  set data(val) {
    this.$data = (typeof val !== 'object')
      ? val
      : {
        ...this.$data,
        ...val,
      };
  }

  setData(key, val, mergeKey = true) {
    if (!this.data) {
      this.data = {};
    }
    this.data[key] = (typeof val === 'string')
      ? val
      : {
        ...(mergeKey
          ? this.data[key]
          : undefined),
        ...val,
      };
  }

  resetData(key) {
    if ((this.data || {})[key]) {
      delete this.data[key];
    }
  }

  resetAllData() {
    this.data = undefined;
  }

  toJSON() {
    return CommonUtils.neat({
      ...super.toJSON(),
      input: this.input,
      data: this.data || {},
      output: this.output,
    });
  }

  miniJSON() {
    return super.toJSON();
  }

  get responseData() {
    return this.miniJSON();
  }

  getRemainingTime() {
    return this.$fnGetRemainingTime();
  }

  quitNow() {
    return (this.getRemainingTime() - StateData.Constants.LambdaTimeoutThreshold) <= 0;
  }
}

module.exports = StateData;
