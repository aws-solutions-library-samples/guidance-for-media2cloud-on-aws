/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
const {
  VideoAsset,
} = require('./videoAsset');

const {
  DBConfig,
} = require('./dbConfig');

class StateIOData {
  constructor(params = {}) {
    const {
      Service,
      State,
      Status,
      Progress = 1,
      StateMachine,
      Data,
      Config,
      DataInTransit,
      ErrorMessage,
    } = params;

    this.$service = Service;
    this.$state = State;
    this.$status = Status;
    this.$progress = Progress;
    this.$stateMachine = StateMachine;
    this.$data = Object.assign({}, Data);
    this.$config = Object.assign({}, Config);
    this.$dataInTransit = Object.assign({}, DataInTransit);
    this.$errorMessage = ErrorMessage;
    /* instead of Data object, this could be VideoAsset instance */
    this.$dataSrc = null;
    /* instead of Config object, this could be DBConfig instance */
    this.$configSrc = null;
  }

  get service() {
    return this.$service;
  }

  set service(val) {
    this.$service = val;
  }

  get state() {
    return this.$state;
  }

  set state(val) {
    this.$state = val;
  }

  get status() {
    return this.$status;
  }

  set status(val) {
    this.$status = val;

    if (val === 'COMPLETED' || val === 'OBJECTCREATED') {
      this.$progress = 100;
    }
  }

  get progress() {
    return this.$progress;
  }

  set progress(val) {
    this.$progress = Math.min(val, 99);
  }

  get stateMachine() {
    return this.$stateMachine;
  }

  set stateMachine(val) {
    this.$stateMachine = val;
  }

  get dataSrc() {
    return this.$dataSrc;
  }

  set dataSrc(val) {
    this.$dataSrc = val;
  }

  get configSrc() {
    return this.$configSrc;
  }

  set configSrc(val) {
    this.$configSrc = val;
  }

  get data() {
    return (this.$dataSrc) ? this.$dataSrc.toJSON() : this.$data;
  }

  set data(val) {
    if (val instanceof VideoAsset) {
      this.$dataSrc = val;
    } else {
      this.$data = Object.assign({}, this.$data, val);
    }
  }

  get config() {
    return (this.$configSrc) ? this.$configSrc.toJSON() : this.$config;
  }

  set config(val) {
    if (val instanceof DBConfig) {
      this.$configSrc = val;
    } else {
      this.$config = Object.assign({}, this.$config, val);
    }
  }

  get dataInTransit() {
    return this.$dataInTransit;
  }

  set dataInTransit(val) {
    this.$dataInTransit = Object.assign({}, this.$dataInTransit, val);
  }

  get errorMessage() {
    return this.$errorMessage;
  }

  set errorMessage(val) {
    this.$errorMessage = val;
    this.status = 'FAILED';
  }

  hasError() {
    return !!this.$errorMessage;
  }

  hasUUID() {
    return (this.$dataSrc && this.$dataSrc.uuid) || (this.$data && this.$data.UUID);
  }

  toJSON() {
    const response = this.compact();
    response.Data = this.data;
    response.Config = this.config;
    response.DataInTransit = this.dataInTransit;
    return response;
  }

  compact() {
    const response = {
      Service: this.service,
      State: this.state,
      Status: this.status,
      Progress: this.progress,
      StateMachine: this.stateMachine,
      Timestamp: new Date().toISOString(),
    };

    response.Data = (this.hasUUID()) ? { UUID: this.data.UUID } : this.data;

    if (this.hasError()) {
      response.ErrorMessage = this.errorMessage.message;
    }

    return response;
  }

  /**
   * @function normalizeStatus
   * @param {string} status
   */
  static normalizeStatus(status) {
    switch (status) {
      case 'COMPLETE':
      case 'SUCCEEDED':
        return 'COMPLETED';

      case 'SUBMITTED':
      case 'PROGRESSING':
      case 'RUNNING':
        return 'IN_PROGRESS';

      case 'FAILED':
      case 'TIMED_OUT':
      case 'ABORTED':
      case 'CANCELED':
      case 'ERROR':
        return 'FAILED';

      default:
        return 'UNKNOWN';
    }
  }
}

module.exports = {
  StateIOData,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    StateIOData,
  });
