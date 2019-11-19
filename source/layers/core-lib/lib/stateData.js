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
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */

const {
  StateMessage,
} = require('./stateMessage');

const {
  mxCommonUtils,
  mxNeat,
} = require('./mxCommonUtils');

class X extends mxCommonUtils(mxNeat(class {})) {}

/**
 * @class StateData
 * @description simple wrapper class to handle input/ouput data with this state machine
 */
class StateData extends StateMessage {
  constructor(stateMachine, event, context) {
    super({
      stateMachine,
      uuid: event.uuid,
      operation: event.operation,
      status: event.status,
      progress: event.progress,
    });

    this.$event = Object.assign({}, event);
    this.$accountId = context.invokedFunctionArn.split(':')[4];
    this.$fnGetRemainingTime = context.getRemainingTimeInMillis.bind();
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

  get accountId() {
    return this.$accountId;
  }

  get input() {
    return this.event.input;
  }

  get output() {
    return this.event.next;
  }

  get responseData() {
    return super.toJSON();
  }

  getRemainingTime() {
    return this.$fnGetRemainingTime();
  }

  quitNow() {
    return (this.getRemainingTime() - StateData.Constants.LambdaTimeoutThreshold) <= 0;
  }

  toNextState() {
    return X.neat({
      operation: this.operation,
      status: this.status,
      progress: (this.status !== StateData.Statuses.InProgress) ? 0 : this.progress,
      uuid: this.uuid,
      next: Object.assign({}, this.event.input, this.event.next),
    });
  }

  toJSON() {
    return X.neat(Object.assign({}, this.event, this.responseData));
  }
}

module.exports = {
  StateData,
};
