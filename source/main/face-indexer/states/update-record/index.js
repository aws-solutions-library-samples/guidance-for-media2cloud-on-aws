// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const BaseState = require('../shared/base');

class StateUpdateRecord extends BaseState {
  get id() {
    return this.event.itemId;
  }

  get input() {
    return this.event.itemData;
  }

  get uuid() {
    return this.input.uuid;
  }

  get updated() {
    return this.input.updated || [];
  }

  get deleted() {
    return this.input.deleted || [];
  }

  async process() {
    console.log('==== PROCESSING: StateUpdateRecord: MapItemId:', this.id, '====');

    const uuid = this.uuid;
    const updated = this.updated;
    const deleted = this.deleted;

    return this.processWithUuid(uuid, updated, deleted)
      .then((res) => {
        console.log('==== COMPLETED: StateUpdateRecord: MapItemId:', this.id, '====');
        console.log('response', JSON.stringify(res));
        return uuid;
      });
  }
}

module.exports = StateUpdateRecord;
