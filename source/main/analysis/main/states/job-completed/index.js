// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Environment: {
    Solution: {
      Metrics: {
        AnonymousUsage,
      },
    },
    DynamoDB: {
      Ingest: {
        Table: IngestTable,
        PartitionKey: IngestPartitionKey,
      },
      AIML: {
        Table: AnalysisTable,
        PartitionKey: AnalysisPartitionKey,
        SortKey: AnalysisSortKey,
      },
    },
  },
  DB,
  StateData,
  SNS,
  Metrics,
  AnalysisError,
} = require('core-lib');

const {
  Statuses: {
    Completed,
    AnalysisCompleted,
  },
} = StateData;

const INGEST_FIELDS = [
  'analysis',
  'bucket',
  'key',
  'type',
  'duration',
  'fileSize',
];

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
    let promises = [];

    const types = Object.keys(this.stateData.data);

    // update analysis table
    types.forEach((type) =>
      promises.push(this.updateAnalysisTableByType(type)));

    // update ingest table
    promises.push(this.updateIngestTable(types)
      .then((res) => {
        const src = {
          bucket: res.bucket,
          key: res.key,
          type: res.type,
        };
        this.stateData.setData('src', src);
        return res;
      }));

    await Promise.all(promises);
    promises = [];

    const input = this.stateData.input;
    if (input.metric === undefined) {
      input.metric = {};
    }
    input.metric.endTime = Date.now();
    this.stateData.setCompleted(AnalysisCompleted);

    // send anonymous data
    promises.push(this.sendAnonymous()
      .catch(() =>
        false));

    // send sns message
    const uuid = this.stateData.uuid;
    const subject = `analysis: ${uuid}`;
    const message = this.stateData.toJSON();
    promises.push(SNS.send(subject, message)
      .catch(() =>
        false));

    return Promise.all(promises)
      .then(() =>
        this.stateData.toJSON());
  }

  async updateIngestTable(analyzedCategories) {
    const uuid = this.stateData.uuid;

    const db = new DB({
      Table: IngestTable,
      PartitionKey: IngestPartitionKey,
    });

    const fields = await db.fetch(
      this.stateData.uuid,
      undefined,
      INGEST_FIELDS
    );

    let categories = analyzedCategories;
    if ((fields.analysis || []).length > 0) {
      categories = categories.concat(fields.analysis);
      categories = [
        ...new Set(categories),
      ];
    }

    const updateFields = {
      overallStatus: Completed,
      status: AnalysisCompleted,
      analysis: categories,
    };

    return db.update(
      uuid,
      undefined,
      updateFields,
      false
    ).then(() =>
      fields);
  }

  async updateAnalysisTableByType(type) {
    const uuid = this.stateData.uuid;
    const data = this.stateData.data[type];

    const db = new DB({
      Table: AnalysisTable,
      PartitionKey: AnalysisPartitionKey,
      SortKey: AnalysisSortKey,
    });

    return db.update(uuid, type, data);
  }

  async sendAnonymous() {
    if (!AnonymousUsage) {
      return undefined;
    }

    const uuid = this.stateData.uuid;
    const input = this.stateData.input;
    const aiml = {
      ...input.aiOptions,
      customVocabulary: undefined,
      faceCollectionId: undefined,
    };
    const metrics = input.metrics || {};

    return Metrics.sendAnonymousData({
      uuid,
      process: 'analysis',
      requestTime: metrics.requestTime,
      contentDuration: input.duration || 0,
      elapsed: metrics.endTime - metrics.startTime,
      aiml,
    }).catch((e) =>
      console.log(`ERR: sendAnonymous: ${e.message}`));
  }
}

module.exports = StateJobCompleted;
