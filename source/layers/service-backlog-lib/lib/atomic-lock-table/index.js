// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ConditionalCheckFailedException,
} = require('@aws-sdk/client-dynamodb');
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
const xraysdkHelper = require('../shared/xraysdkHelper');
const retryStrategyHelper = require('../shared/retryStrategyHelper');
const {
  marshalling,
  unmarshalling,
} = require('../shared/ddbHelper');
const {
  M2CException,
} = require('../shared/error');

const TTL_MIN = 60;
const TTL_MAX = 86400; // max for a day
const TTL_DEFAULT = 3600; // lock for 1 hour

const MAX_ATTEMPTS = 10;

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
      throw new M2CException('missing environment variable');
    }
    return {
      name: DDB.Name,
      partition: DDB.PartitionKey,
    };
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

    return AtomicLockTable.createItem(params)
      .catch((e) => {
        console.error(
          'ERR:',
          'AtomicLockTable.acquire:',
          'AtomicLockTable.createItem:',
          e.$metadata.httpStatusCode,
          e.name,
          lockId
        );
        throw e;
      });
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
      .then(() =>
        true)
      .catch((e) => {
        if (e instanceof ConditionalCheckFailedException) {
          return false;
        }

        console.error(
          'ERR:',
          'AtomicLockTable.release:',
          'AtomicLockTable.deleteItem:',
          e.$metadata.httpStatusCode,
          e.name,
          lockId
        );
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
      .then(() =>
        true)
      .catch((e) => {
        if (e instanceof ConditionalCheckFailedException) {
          return false;
        }
        console.error(
          'ERR:',
          'AtomicLockTable.updateTTL:',
          'AtomicLockTable.updateItem:',
          e.$metadata.httpStatusCode,
          e.name,
          lockId
        );
        throw e;
      });
  }

  static async createItem(params) {
    const marshalled = marshalling(params);

    const ddbClient = xraysdkHelper(new DynamoDBClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(MAX_ATTEMPTS),
    }));

    const command = new PutItemCommand(marshalled);

    return ddbClient.send(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);
        return {
          ...unmarshalled,
          $metadata: undefined,
        };
      });
  }

  static async deleteItem(params) {
    const marshalled = marshalling(params);

    const ddbClient = xraysdkHelper(new DynamoDBClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(MAX_ATTEMPTS),
    }));

    const command = new DeleteItemCommand(marshalled);

    return ddbClient.send(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);
        return {
          ...unmarshalled,
          $metadata: undefined,
        };
      });
  }

  static async updateItem(params) {
    const marshalled = marshalling(params);

    const ddbClient = xraysdkHelper(new DynamoDBClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(MAX_ATTEMPTS),
    }));

    const command = new UpdateItemCommand(marshalled);

    return ddbClient.send(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);
        return {
          ...unmarshalled,
          $metadata: undefined,
        };
      });
  }
}

module.exports = AtomicLockTable;
