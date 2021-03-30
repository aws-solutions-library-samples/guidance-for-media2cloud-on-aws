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

const OUTPUT_TYPE_PROXY = 'proxy';
const OUTPUT_TYPE_AIML = 'aiml';
const OUTPUT_TYPE_PROD = 'prod';

class StateUpdateRecord {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateUpdateRecord';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const input = this.stateData.input;
    const data = this.stateData.data;
    if (!input.bucket || !input.key) {
      throw new IngestError('fail to find input.bucket and key');
    }
    const dst = data.transcode.output;
    if (!dst) {
      throw new IngestError('fail to find proxy destination');
    }

    const bucket = input.destination.bucket;
    const ots = [
      OUTPUT_TYPE_AIML,
      OUTPUT_TYPE_PROD,
    ];

    const proxies = [];
    while (ots.length) {
      const ot = ots.shift();
      const responses = await CommonUtils.listObjects(bucket, PATH.join(dst, ot));
      while (responses.length) {
        const response = responses.shift();
        const mime = CommonUtils.getMime(response.Key);
        proxies.push({
          ...this.parseObjectProps(response),
          key: response.Key,
          outputType: ot,
          mime,
          type: CommonUtils.parseMimeType(mime),
        });
      }
    }

    /* Find the largest JPG frame capture image */
    let frameCaptures = await CommonUtils.listObjects(bucket, PATH.join(dst, OUTPUT_TYPE_PROXY));
    if (frameCaptures.length > 0) {
      frameCaptures = frameCaptures.sort((a, b) => b.Size - a.Size).shift();
      const mime = CommonUtils.getMime(frameCaptures.Key);
      proxies.push({
        ...this.parseObjectProps(frameCaptures),
        key: frameCaptures.Key,
        outputType: OUTPUT_TYPE_PROXY,
        mime,
        type: CommonUtils.parseMimeType(mime),
      });
    }

    if (!proxies.length) {
      throw new IngestError(`fail to find proxy under ${bucket}/${dst}`);
    }

    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.update(this.stateData.uuid, undefined, {
      proxies,
    }, false);

    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  parseObjectProps(data) {
    return Object.assign({
      key: data.Key,
      fileSize: data.Size,
      storageClass: data.StorageClass || 'STANDARD',
      lastModified: new Date(data.LastModified).getTime(),
    }, data.Metadata);
  }
}

module.exports = StateUpdateRecord;
