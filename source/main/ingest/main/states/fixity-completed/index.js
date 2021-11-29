// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const {
  StateData,
  IngestError,
  DB,
  Environment,
} = require('core-lib');
const {
  MediaInfoCommand,
} = require('mediainfo');

const MEDIATYPE_VIDEO = 'video';
const MEDIATYPE_AUDIO = 'audio';

class StateFixityCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateFixityCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  /* If type is video, double check to make sure the asset indeed contains video track */
  async confirmMediaType() {
    const src = this.stateData.input;
    if (src.type !== MEDIATYPE_VIDEO) {
      return src.type;
    }
    const mi = new MediaInfoCommand();
    await mi.analyze({
      Bucket: src.bucket,
      Key: src.key,
    });
    const video = mi.video;
    return ((video || []).length > 0)
      ? MEDIATYPE_VIDEO
      : MEDIATYPE_AUDIO;
  }

  async updateMediaType(type) {
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    return db.update(this.stateData.uuid, undefined, {
      type,
    }, false);
  }

  async process() {
    const type = await this.confirmMediaType();
    if (this.stateData.input.type !== type) {
      this.stateData.input.type = type;
      await this.updateMediaType(type);
    }
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateFixityCompleted;
