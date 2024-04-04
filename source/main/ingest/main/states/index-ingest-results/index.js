// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DB,
  Environment,
  StateData,
  Metrics,
  Indexer,
  IngestError,
} = require('core-lib');

const INDEX_CONTENT = Indexer.getContentIndex();
const INGEST_FIELDS = Indexer.getIngestFields();

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
    const result = await db.fetch(
      uuid,
      undefined,
      INGEST_FIELDS
    );

    const indexer = new Indexer();
    await indexer.indexDocument(
      INDEX_CONTENT,
      uuid,
      result
    ).catch((e) => {
      console.error(
        'ERR:',
        'StateIndexIngestResults.process:',
        'indexer.indexDocument:',
        e.name,
        e.message,
        INDEX_CONTENT,
        uuid,
        JSON.stringify(result)
      );
      throw e;
    });

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
