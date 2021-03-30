/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const PATH = require('path');
const {
  DB,
  CommonUtils,
  Environment,
  StateData,
  IngestError,
} = require('core-lib');
const {
  MediaInfoCommand,
} = require('mediainfo');

const CATEGORY = 'mediainfo';
const XML_OUTPUT = `${CATEGORY}.xml`;
const JSON_OUTPUT = `${CATEGORY}.json`;

class StateRunMediaInfo {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateRunMediaInfo';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const src = this.stateData.input;
    if (!src.destination || !src.destination.bucket || !src.destination.prefix) {
      throw new IngestError('missing destination');
    }
    /* #1: run mediainfo */
    const mi = new MediaInfoCommand();
    const fullData = await mi.analyze({
      Bucket: src.bucket,
      Key: src.key,
    });
    /* #2: store mediainfo.json and mediainfo.xml */
    const mediainfo = await this.uploadMediainfoFiles(src.destination, fullData, mi.rawXml);
    /* #3: update table */
    const parsed = mi.miniData;
    const duration = ((parsed.container[0] || {}).duration || 0) * 1000;
    const framerate = (parsed.video[0] || {}).frameRate || (parsed.container[0] || {}).frameRate;
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.update(this.stateData.uuid, undefined, {
      mediainfo,
      framerate,
      duration,
    }, false);
    /* #4: update state data */
    this.stateData.input.duration = duration;
    this.stateData.input.framerate = framerate;
    this.stateData.setData(CATEGORY, {
      ...parsed,
      output: mediainfo,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async uploadMediainfoFiles(dest, json, xml) {
    const bucket = dest.bucket;
    const prefix = PATH.join(dest.prefix, CATEGORY);
    return Promise.all([
      CommonUtils.uploadFile(bucket, prefix, JSON_OUTPUT, json)
        .then(() => PATH.join(prefix, JSON_OUTPUT))
        .catch(e => console.error(e)),
      CommonUtils.uploadFile(bucket, prefix, XML_OUTPUT, xml)
        .then(() => PATH.join(prefix, XML_OUTPUT))
        .catch(e => console.error(e)),
    ]);
  }
}

module.exports = StateRunMediaInfo;
