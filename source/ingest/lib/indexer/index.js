/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const {
  DB,
  Environment,
  Metrics,
  BaseIndex,
} = require('m2c-core-lib');

/**
 * @class Indexer
 */
class Indexer extends BaseIndex {
  constructor(stateData) {
    super();
    this.$stateData = stateData;
  }

  get stateData() {
    return this.$stateData;
  }

  /**
   * @async
   * @override
   * @function indexResults
   * @description index aiml analysis results to elasticsearch engine
   */
  async indexResults(...args) {
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    const result = await db.fetch(this.stateData.uuid);

    if (Object.keys(result || {}).length) {
      /* clean up the payload */
      [
        'proxies',
        'web-upload',
        'schemaVersion',
        'storageClass',
        'analysis',
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

  /**
   * @async
   * @function sendAnonymous
   * @description send anonymous data to help us to improve the solution
   * @param {Object} data - ingest db row
   */
  async sendAnonymous(data) {
    if (!Environment.Solution.Metrics.AnonymousUsage) {
      return;
    }
    const duration = ((((data.mediainfo || {}).file || {}).track || []).find(x =>
      x.$.type.toLowerCase() === 'general') || {}).duration;
    await Metrics.sendAnonymousData({
      uuid: this.stateData.uuid,
      process: 'ingest',
      fileSize: data.fileSize,
      duration: duration || 0,
      mime: data.mime,
    }).catch(e => console.log(`sendAnonymous: ${e.message}`));
  }
}

module.exports = {
  Indexer,
};
