// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('aws-sdk');
  }
})();
const Retry = require('../shared/retry');
const {
  DynamoDB: DDB,
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('../shared/defs');

const TTL_MIN = 60;
const TTL_MAX = 172800;
const TTL_DEFAULT = 86400;

/**
 * Main table: id-serviceApi
 * | id (P) | serviceApi (S) |
 *
 * GSI: status-timestamp
 * | status (P) | timestamp (S) | serviceParams |
 *
 * GSI: jobId
 * | jobId (P) |
 */
class BacklogTable {
  static timeToLiveInSeconds(seconds = TTL_DEFAULT) {
    const max = Math.max(seconds, TTL_MIN);
    const ttl = Math.min(max, TTL_MAX);
    return Math.floor((new Date().getTime() / 1000) + ttl);
  }

  static getTable() {
    if (!DDB.Name) {
      throw new Error('missing environment variable');
    }
    return {
      name: DDB.Name,
      partition: DDB.PartitionKey,
      sort: DDB.SortKey,
    };
  }

  static getStatusGSI() {
    if (!DDB.Name || !DDB.GSI.Status.Index) {
      throw new Error('missing environment variable');
    }
    return {
      name: DDB.Name,
      index: DDB.GSI.Status.Index,
      partition: DDB.GSI.Status.PartitionKey,
      sort: DDB.GSI.Status.SortKey,
    };
  }

  static getJobIdGSI() {
    if (!DDB.Name || !DDB.GSI.JobId.Index) {
      throw new Error('missing environment variable');
    }
    return {
      name: DDB.Name,
      index: DDB.GSI.JobId.Index,
      partition: DDB.GSI.JobId.PartitionKey,
    };
  }

  static getDocumentClient() {
    return new AWS.DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
      customUserAgent: CustomUserAgent,
    });
  }

  static async createItem(params) {
    const db = BacklogTable.getDocumentClient();
    return Retry.run(db.put.bind(db), params, 10);
  }

  static async updateItem(params) {
    const db = BacklogTable.getDocumentClient();
    return Retry.run(db.update.bind(db), params, 10);
  }

  static async deleteItem(params) {
    const db = BacklogTable.getDocumentClient();
    return Retry.run(db.delete.bind(db), params, 10);
  }

  static async queryItems(params, limit = 10) {
    const db = BacklogTable.getDocumentClient();
    const fn = db.query.bind(db);

    let response;
    const items = [];
    do {
      response = await Retry.run(fn, {
        ...params,
        ExclusiveStartKey: (response || {}).LastEvaluatedKey,
      });
      items.splice(items.length, 0, ...response.Items);
    } while (response.LastEvaluatedKey && items.length < limit);
    return items;
  }
}

module.exports = BacklogTable;
