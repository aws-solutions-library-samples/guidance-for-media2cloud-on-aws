/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */

const {
  States,
} = require('./states');

const {
  Statuses,
} = require('./statuses');

/**
 * @class StateMessage
 * @description state message object being sent and received through IoT message broker
 */
class StateMessage {
  constructor(params = {}) {
    this.$uuid = params.uuid;
    this.$stateMachine = params.stateMachine;
    this.$operation = params.operation;
    this.$status = params.status;
    this.$progress = Number.parseInt(params.progress || 0, 10);
    this.$errorMessage = params.errorMessage;
    this.$data = params.data ? Object.assign({}, params.data) : undefined;
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'StateMessage';
  }
  /* eslint-enable class-methods-use-this */

  static get States() {
    return States;
  }

  static get Statuses() {
    return Statuses;
  }

  get uuid() {
    return this.$uuid;
  }

  set uuid(val) {
    this.$uuid = val;
  }

  get stateMachine() {
    return this.$stateMachine;
  }

  set stateMachine(val) {
    this.$stateMachine = val;
  }

  get operation() {
    return this.$operation;
  }

  set operation(val) {
    this.$operation = val;
  }

  get status() {
    return this.$status;
  }

  set status(val) {
    this.$status = val;
  }

  get progress() {
    return this.$progress;
  }

  set progress(val) {
    this.$progress = Number.parseInt(val || 0, 10);
  }

  get errorMessage() {
    return this.$errorMessage;
  }

  set errorMessage(e) {
    this.$errorMessage = (e instanceof Error) ? e.message : e;
  }

  get data() {
    return this.$data;
  }

  set data(val) {
    this.$data = (typeof val !== 'object') ? val : Object.assign(this.$data, val);
  }

  setState(stateMachine, operation) {
    this.stateMachine = stateMachine;
    this.operation = operation;
  }

  setStarted() {
    this.status = Statuses.Started;
    this.progress = 0;
  }

  setCompleted() {
    this.status = Statuses.Completed;
    this.progress = 100;
  }

  setProgress(val) {
    this.status = Statuses.InProgress;
    this.progress = Math.min(100, Number.parseInt(val, 10));
  }

  setFailed(e) {
    this.status = Statuses.Error;
    this.errorMessage = e;
  }

  setNoData() {
    this.status = Statuses.NoData;
    this.progress = 100;
  }

  setData(key, val, mergeKey = true) {
    if (!this.event.next) {
      this.event.next = {};
    }
    if (val === undefined && !mergeKey) {
      delete this.event.next[key];
      if ((this.event.input || {})[key]) {
        delete this.event.input[key];
      }
    } else {
      this.event.next[key]
        = Object.assign({}, mergeKey ? (this.event.input || {})[key] : undefined, val);
    }
  }

  resetData(key) {
    if ((this.event.next || {}).key) {
      this.event.next[key] = undefined;
    }
  }

  resetAllData() {
    this.event.input = undefined;
    this.event.next = undefined;
  }


  toJSON() {
    return {
      uuid: this.uuid,
      stateMachine: this.stateMachine,
      operation: this.operation,
      status: this.status,
      progress: this.progress,
      errorMessage: this.errorMessage,
      data: this.data,
    };
  }
}

module.exports = {
  StateMessage,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    StateMessage,
  });
