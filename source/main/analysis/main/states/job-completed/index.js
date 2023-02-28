// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DB,
  Environment,
  StateData,
  SNS,
  Metrics,
  AnalysisError,
} = require('core-lib');

class StateJobCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateJobCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const types = Object.keys(this.stateData.data);

    /* update analysis table */
    await Promise.all(types.map(type =>
      this.updateAnalysisTableByType(type)));

    /* update ingest table */
    const attrib = await this.updateIngestTable(types);

    this.stateData.setData('src', {
      bucket: attrib.bucket,
      key: attrib.key,
      type: attrib.type,
    });
    this.stateData.input.metrics.endTime = new Date().getTime();
    this.stateData.setCompleted(StateData.Statuses.AnalysisCompleted);

    /* send anonymous data */
    await this.sendAnonymous();
    /* send SNS notification */
    await SNS.send(`analysis: ${this.stateData.uuid}`, this.stateData.toJSON()).catch(() => false);
    return this.stateData.toJSON();
  }

  async updateIngestTable(analyzedCategories) {
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    const attributes = await db.fetch(this.stateData.uuid, undefined, [
      'analysis',
      'bucket',
      'key',
      'type',
      'duration',
      'fileSize',
    ]);

    let categories = analyzedCategories.concat(attributes.analysis || []);
    categories = [
      ...new Set(categories),
    ];

    const uuid = this.stateData.uuid;
    await db.update(uuid, undefined, {
      overallStatus: StateData.Statuses.Completed,
      status: StateData.Statuses.AnalysisCompleted,
      analysis: categories,
    }, false);

    return attributes;
  }

  async updateAnalysisTableByType(type) {
    const uuid = this.stateData.uuid;
    const data = this.stateData.data[type];

    const db = new DB({
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    });
    return db.update(uuid, type, data);
  }

  async sendAnonymous() {
    if (!Environment.Solution.Metrics.AnonymousUsage) {
      return undefined;
    }

    const aiml = {
      ...this.stateData.input.aiOptions,
      customVocabulary: undefined,
      faceCollectionId: undefined,
    };
    const metrics = this.stateData.input.metrics || {};

    return Metrics.sendAnonymousData({
      uuid: this.stateData.uuid,
      process: 'analysis',
      requestTime: metrics.requestTime,
      contentDuration: this.stateData.input.duration || 0,
      elapsed: metrics.endTime - metrics.startTime,
      aiml,
    }).catch(e => console.log(`sendAnonymous: ${e.message}`));
  }
}

module.exports = StateJobCompleted;
