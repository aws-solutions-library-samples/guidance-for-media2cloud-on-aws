// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDB: DDB,
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
const TTL_MAX = 172800;
const TTL_DEFAULT = 86400;

const MAX_ATTEMPTS = 10;

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
      throw new M2CException('missing environment variable');
    }
    return {
      name: DDB.Name,
      partition: DDB.PartitionKey,
      sort: DDB.SortKey,
    };
  }

  static getStatusGSI() {
    if (!DDB.Name || !DDB.GSI.Status.Index) {
      throw new M2CException('missing environment variable');
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
      throw new M2CException('missing environment variable');
    }
    return {
      name: DDB.Name,
      index: DDB.GSI.JobId.Index,
      partition: DDB.GSI.JobId.PartitionKey,
    };
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

  static async queryItems(params, limit = 10) {
    const marshalled = marshalling(params);
    let lastEvaluatedKey;
    let items = [];

    do {
      const ddbClient = xraysdkHelper(new DynamoDBClient({
        customUserAgent: CustomUserAgent,
        retryStrategy: retryStrategyHelper(MAX_ATTEMPTS),
      }));

      const command = new QueryCommand({
        ...marshalled,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      await ddbClient.send(command)
        .then((res) => {
          lastEvaluatedKey = res.LastEvaluatedKey;

          const unmarshalled = unmarshalling(res);
          items = items.concat(unmarshalled.Items);
        });
    } while (lastEvaluatedKey && items.length < limit);

    return items;
  }
}

module.exports = BacklogTable;
