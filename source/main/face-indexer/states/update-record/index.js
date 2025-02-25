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

  get uuids() {
    return this.input.uuids;
  }

  get updated() {
    return this.input.updated || [];
  }

  get deleted() {
    return this.input.deleted || [];
  }

  async process() {
    console.log('==== PROCESSING: StateUpdateRecord: MapItemId:', this.id, '====');

    const updated = this.updated;
    const deleted = this.deleted;

    let uuids = [];
    if (this.uuids !== undefined && this.uuids.length > 0) {
      uuids = this.uuids;
    } else if (this.uuid !== undefined) {
      uuids.push(this.uuid);
    }

    for (const uuid of uuids) {
      console.log(`==== UPDATING: StateUpdateRecord: ${uuid}: `);
      const response = await this.processWithUuid(uuid, updated, deleted);
      console.log(`response: ${JSON.stringify(response)}`);
    }

    return uuids;
  }
}

module.exports = StateUpdateRecord;
