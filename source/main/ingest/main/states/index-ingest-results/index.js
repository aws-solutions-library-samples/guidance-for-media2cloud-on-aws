// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const {
  DB,
  Environment,
  StateData,
  Metrics,
  Indexer,
  IngestError,
} = require('core-lib');

const INDEX_INGEST = 'ingest';

class StateIndexIngestResults {
  constructor(stateData) {
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
    const uuid = this.stateData.uuid;
    const result = await db.fetch(uuid, undefined,
      [
        'overallStatus',
        'lastModified',
        'timestamp',
        'status',
        'basename',
        'attributes',
        'bucket',
        'group',
        'fileSize',
        'mime',
        'framerate',
        'uuid',
        'key',
        'duration',
        'type',
        'md5',
      ]);
    const indexer = new Indexer();
    await indexer.indexDocument(INDEX_INGEST, uuid, result)
      .catch((e) =>
        console.error(`[ERR]: indexDocument: ${INDEX_INGEST}: ${uuid}:`, e));

    await this.sendAnonymous(result);
    this.stateData.setData('indexer', {
      terms: Object.keys(result),
    });
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
