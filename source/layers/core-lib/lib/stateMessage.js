// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const States = require('./states');
const Statuses = require('./statuses');

/**
 * @class StateMessage
 * @description state message object being sent and received through IoT message broker
 */
class StateMessage {
  constructor(params = {}) {
    this.$uuid = params.uuid;
    this.$stateMachine = params.stateMachine;
    this.$operation = params.operation;
    this.$status = params.status || Statuses.NotStarted;
    this.$progress = Number.parseInt(params.progress || 0, 10);
    this.$errorMessage = params.errorMessage;
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

  get overallStatus() {
    return (this.status.indexOf(Statuses.Error) >= 0)
      ? Statuses.Error
      : (this.status === Statuses.AnalysisCompleted)
        ? Statuses.Completed
        : Statuses.Processing;
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

  setStarted(status) {
    this.status = status || Statuses.Started;
    this.progress = 0;
  }

  setCompleted(status) {
    this.status = status || Statuses.Completed;
    this.progress = 100;
  }

  setProgress(val) {
    this.status = Statuses.InProgress;
    this.progress = Math.min(100, Number(val));
  }

  setFailed(e) {
    this.status = Statuses.Error;
    this.errorMessage = e;
  }

  setNoData() {
    this.status = Statuses.NoData;
    this.progress = 100;
  }

  toJSON() {
    return {
      uuid: this.uuid,
      stateMachine: this.stateMachine,
      operation: this.operation,
      overallStatus: this.overallStatus,
      status: this.status,
      progress: this.progress,
      errorMessage: this.errorMessage,
    };
  }
}

module.exports = StateMessage;
