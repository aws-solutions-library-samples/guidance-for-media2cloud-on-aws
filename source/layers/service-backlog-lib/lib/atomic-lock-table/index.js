// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const Retry = require('../shared/retry');
const {
  DynamoDB: {
    AtomicLock: DDB,
  },
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('../shared/defs');

const TTL_MIN = 60;
const TTL_MAX = 86400; // max for a day
const TTL_DEFAULT = 3600; // lock for 1 hour

/**
 * Main table: name of the lock
 * | lockId (P) |
 */
class AtomicLockTable {
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
    };
  }

  static getDocumentClient() {
    return new AWS.DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
      customUserAgent: CustomUserAgent,
    });
  }

  static async acquire(lockId, ttl = TTL_DEFAULT) {
    const ddb = AtomicLockTable.getTable();
    const params = {
      TableName: ddb.name,
      Item: {
        [ddb.partition]: lockId,
        ttl: AtomicLockTable.timeToLiveInSeconds(ttl),
      },
      Expected: {
        [ddb.partition]: {
          Exists: false,
        },
      },
    };
    return AtomicLockTable.createItem(params);
  }

  static async release(lockId) {
    const ddb = AtomicLockTable.getTable();
    const params = {
      TableName: ddb.name,
      Key: {
        [ddb.partition]: lockId,
      },
      Expected: {
        ttl: {
          ComparisonOperator: 'NOT_NULL',
        },
      },
    };
    return AtomicLockTable.deleteItem(params)
      .then(() => true)
      .catch((e) => {
        if (e.code === 'ConditionalCheckFailedException') {
          return false;
        }
        console.error(`ERR: AtomicLockTable.release: ${e.code}: ${e.message} (${lockId})`);
        throw e;
      });
  }

  static async updateTTL(lockId, ttl) {
    const ddb = AtomicLockTable.getTable();
    const timeToLive = AtomicLockTable.timeToLiveInSeconds(ttl);
    const params = {
      TableName: ddb.name,
      Key: {
        [ddb.partition]: lockId,
      },
      AttributeUpdates: {
        ttl: {
          Action: 'PUT',
          Value: timeToLive,
        },
      },
      Expected: {
        ttl: {
          ComparisonOperator: 'LT',
          Value: timeToLive,
        },
      },
    };
    return AtomicLockTable.updateItem(params)
      .then(() => true)
      .catch((e) => {
        if (e.code === 'ConditionalCheckFailedException') {
          return false;
        }
        console.error(`ERR: AtomicLockTable.updateTTL: ${e.code}: ${e.message} (${lockId})`);
        throw e;
      });
  }

  static async createItem(params) {
    const db = AtomicLockTable.getDocumentClient();
    return Retry.run(db.put.bind(db), params, 10);
  }

  static async deleteItem(params) {
    const db = AtomicLockTable.getDocumentClient();
    return Retry.run(db.delete.bind(db), params, 10);
  }

  static async updateItem(params) {
    const db = AtomicLockTable.getDocumentClient();
    return Retry.run(db.update.bind(db), params, 10);
  }
}

module.exports = AtomicLockTable;
