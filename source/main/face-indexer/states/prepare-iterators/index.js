// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const BaseState = require('../shared/base');

class StatePrepareIterators extends BaseState {
  get input() {
    return this.event.input;
  }

  get updated() {
    return this.input.updated || [];
  }

  get deleted() {
    return this.input.deleted || [];
  }

  get prioritizedUuid() {
    return this.input.prioritizedUuid;
  }

  async process() {
    let iterators = [];
    const prioritizedUuid = this.prioritizedUuid;
    const nItems = this.updated.length + this.deleted.length;

    if (nItems === 0) {
      return {
        ...this.event,
        iterators,
      };
    }

    if (prioritizedUuid) {
      await this.processWithUuid(
        prioritizedUuid,
        this.updated,
        this.deleted
      );
    }

    // search relevant docs
    let faceIds = this.updated
      .map((item) =>
        item.faceId);

    faceIds = this.deleted
      .map((item) =>
        item.faceId)
      .concat(faceIds);

    // search for relevant uuids that contain these faceIds
    const uuids = await this.searchDocumentsByFaceIds(faceIds)
      .then((res) =>
        res.filter((uuid) =>
          uuid !== prioritizedUuid));

    iterators = uuids
      .map((uuid) => ({
        uuid,
        updated: this.updated,
        deleted: this.deleted,
      }));

    console.log('response', {
      ...this.event,
      iterators,
    });

    return {
      ...this.event,
      iterators,
    };
  }
}

module.exports = StatePrepareIterators;
