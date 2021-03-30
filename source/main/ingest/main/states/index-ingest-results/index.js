/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  DB,
  Environment,
  StateData,
  Metrics,
  BaseIndex,
  IngestError,
} = require('core-lib');

class StateIndexIngestResults extends BaseIndex {
  constructor(stateData) {
    super();
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateIndexIngestResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    const result = await db.fetch(this.stateData.uuid);

    if (Object.keys(result || {}).length) {
      /* TODO: need to update the logic with new elasticsearch implementation */
      /* TODO: need to update the logic with new elasticsearch implementation */
      /* clean up the payload */
      [
        'proxies',
        'web-upload',
        'schemaVersion',
        'storageClass',
        'analysis',
        'mediainfo',
        'imageinfo',
        'docinfo',
      ].forEach(x => delete result[x]);
      await this.indexDocument(this.stateData.uuid, result);
      await this.sendAnonymous(result);
      this.stateData.setData('indexer', {
        terms: Object.keys(result),
      });
    }
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async sendAnonymous(data) {
    if (!Environment.Solution.Metrics.AnonymousUsage) {
      return undefined;
    }
    return Metrics.sendAnonymousData({
      uuid: this.stateData.uuid,
      process: 'ingest',
      fileSize: data.fileSize,
      duration: data.duration || 0,
      mime: data.mime,
    }).catch(e => console.log(`sendAnonymous: ${e.message}`));
  }
}

module.exports = StateIndexIngestResults;
