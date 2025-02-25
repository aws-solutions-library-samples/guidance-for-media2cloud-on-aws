// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  DynamoDBClient,
  BatchGetItemCommand,
  BatchWriteItemCommand,
  QueryCommand,
  ScanCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  Solution: {
    Metrics: {
      CustomUserAgent,
    },
  },
} = require('./environment');
const xraysdkHelper = require('./xraysdkHelper');
const retryStrategyHelper = require('./retryStrategyHelper');
const CommonUtils = require('./commonUtils');
const {
  marshalling,
  unmarshalling,
} = require('./ddbHelper');
const {
  M2CException,
} = require('./error');

/**
 * @class DB
 * @description wrapper of DynamoDB class
 */
class DB {
  constructor(params) {
    /* sanity check */
    const missing = [
      'Table',
      'PartitionKey',
    ].filter((x) =>
      params[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    this.$table = params.Table;
    this.$partitionKey = params.PartitionKey;
    this.$sortKey = params.SortKey;
  }

  static get Constants() {
    return {
      PageSize: 20,
    };
  }

  get [Symbol.toStringTag]() {
    return 'DB';
  }

  get table() {
    return this.$table;
  }

  get partitionKey() {
    return this.$partitionKey;
  }

  get sortKey() {
    return this.$sortKey;
  }

  /**
   * @function update
   * @description update or create DB entry
   * @param {string} primaryValue - partition key value
   * @param {string} [sortValue] - sort key value
   * @param {object} attributes - attributes
   * @param {boolean} [merge] - default to merge entry
   */
  async update(
    primaryValue,
    sortValue,
    attributes,
    merge = true
  ) {
    let original = {};
    if (merge) {
      original = await this.fetch(
        primaryValue,
        sortValue
      );
    }

    let merged = CommonUtils.merge(original, attributes);
    merged = CommonUtils.cleansing(merged, {
      array: false, // don't remove empty array
      object: false, // don't remove empty object
    });
    merged = CommonUtils.sanitizeJson(merged);

    /* make sure no paritionKey is present in the attributes */
    delete merged[this.partitionKey];
    delete merged[this.sortKey];

    const params = {
      TableName: this.table,
      Key: {
        [this.partitionKey]: primaryValue,
      },
      AttributeUpdates: {},
    };

    if (this.sortKey) {
      params.Key[this.sortKey] = sortValue;
    }

    Object.keys(merged)
      .forEach((x) => {
        params.AttributeUpdates[x] = {
          Action: 'PUT',
          Value: merged[x],
        };
      });

    const marshalled = marshalling(params);
    const command = new UpdateItemCommand(marshalled);

    return DB.runCommand(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);
        return {
          ...unmarshalled,
          $metadata: undefined,
        };
      });
  }

  /**
   * @function scan
   * @description scan all entries from DB
   */
  async scan(filter) {
    const params = {
      TableName: this.table,
    };
    if (filter !== undefined) {
      params.ScanFilter = filter;
    }
    const marshalled = marshalling(params);

    let lastEvaluatedKey;
    let items = [];
    do {
      const command = new ScanCommand({
        ...marshalled,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      await DB.runCommand(command)
        .then((res) => {
          lastEvaluatedKey = res.LastEvaluatedKey;

          const unmarshalled = unmarshalling(res);
          items = items.concat(unmarshalled.Items);
        });
    } while (lastEvaluatedKey);

    return items;
  }

  /**
   * @function scanIndex
   * @description scan GSI index
   * @param {*} data
   * @param {string} data.Name - GSI index name
   * @param {string} data.Key - GSI index partition key
   * @param {string} data.Value - GSI index partition value
   * @param {string} [data.Token] - base64 encoded ExclusiveStartKey used to continue from last scan
   * @param {Array} [data.Conditions] - additional conditions, an array of key-value pair
   * @param {number} [data.PageSize] - number of items per page
   * @param {boolean} [data.Ascending] - ascending or decending
   * @return {*} payload
   * @return {Array} payload.Items
   * @return {string} [payload.NextKey] - base64 encoded of LastEvaluatedKey
   */
  async scanIndex(data) {
    const missing = [
      'Name',
      'Key',
      'Value',
    ].filter((x) =>
      data[x] === undefined);

    if (missing.length) {
      throw new M2CException(`scanIndex missing ${missing.join(', ')}`);
    }

    const keyConditions = {
      [data.Key]: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [
          data.Value,
        ],
      },
    };

    const queryFilter = (data.Conditions || [])
      .reduce((a0, c0) => ({
        ...a0,
        [c0.Key]: {
          ComparisonOperator: c0.ComparisonOperator || 'EQ',
          AttributeValueList: [
            c0.Value,
          ],
        },
      }), {});

    const limit = Number(data.PageSize || DB.Constants.PageSize);

    let exclusiveStartKey;
    if (data.Token) {
      exclusiveStartKey = JSON.parse(
        Buffer.from(data.Token, 'base64').toString()
      );
    }

    const params = {
      TableName: this.table,
      IndexName: data.Name,
      KeyConditions: keyConditions,
      QueryFilter: queryFilter,
      ScanIndexForward: !!(data.Ascending),
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    };

    const marshalled = marshalling(params);
    const command = new QueryCommand(marshalled);

    return DB.runCommand(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);

        let nextToken;
        if (unmarshalled.LastEvaluatedKey) {
          nextToken = Buffer.from(
            JSON.stringify(unmarshalled.LastEvaluatedKey)
          ).toString('base64');
        }

        return {
          Items: unmarshalled.Items,
          NextToken: nextToken,
        };
      });
  }

  /**
   * @function fetch
   * @description query a specific db entry
   * @param {string} primaryValue - partition key value
   * @param {string} [sortValue] - sort key value
   * @param {string} [projection] - selected field(s) to return
   */
  async fetch(
    primaryValue,
    sortValue,
    projection
  ) {
    const params = {
      TableName: this.table,
      ExpressionAttributeNames: {
        '#x0': this.partitionKey,
      },
      ExpressionAttributeValues: {
        ':v0': primaryValue,
      },
      KeyConditionExpression: '#x0 = :v0',
    };

    if (this.sortKey) {
      params.ExpressionAttributeNames['#x1'] = this.sortKey;
      params.ExpressionAttributeValues[':v1'] = sortValue;
      if (typeof sortValue === 'string') {
        params.KeyConditionExpression = `${params.KeyConditionExpression} and begins_with(#x1, :v1)`;
      } else {
        params.KeyConditionExpression = `${params.KeyConditionExpression} and #x1 >= :v1`;
      }
    }

    if (projection) {
      let names = projection;
      if (!Array.isArray(names)) {
        names = [
          names,
        ];
      }
      names = names
        .filter((x) =>
          x !== this.partitionKey && x !== this.sortKey);

      params.ExpressionAttributeNames = names
        .reduce((acc, cur, idx) => ({
          ...acc,
          [`#p${idx}`]: cur,
        }), params.ExpressionAttributeNames);

      params.ProjectionExpression =
        Object.keys(params.ExpressionAttributeNames).join(', ');
    }

    const marshalled = marshalling(params);
    const command = new QueryCommand(marshalled);

    return DB.runCommand(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);
        if (!unmarshalled.Count) {
          return {};
        }
        return unmarshalled.Items[0];
      });
  }

  /**
   * @function purge
   * @description delete entry from db
   * @param {string} primaryValue - partition key value
   * @param {string} [sortValue] - sort key value
   */
  async purge(
    primaryValue,
    sortValue
  ) {
    const params = {
      TableName: this.table,
      Key: {
        [this.partitionKey]: primaryValue,
      },
    };

    if (this.sortKey) {
      params.Key[this.sortKey] = sortValue;
    }

    const marshalled = marshalling(params);
    const command = new DeleteItemCommand(marshalled);

    return DB.runCommand(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);
        return {
          ...unmarshalled,
          $metadata: undefined,
        };
      });
  }

  async dropColumns(
    primaryValue,
    sortValue,
    attributes
  ) {
    let items = attributes;

    if (!Array.isArray(items)) {
      items = [
        attributes,
      ];
    }

    items = items
      .filter((x) =>
        x !== this.partitionKey && x !== this.sortKey);

    if (!items.length) {
      return items;
    }

    items = items
      .reduce((acc, cur) => ({
        ...acc,
        [cur]: {
          Action: 'DELETE',
        },
      }), {});

    const params = {
      TableName: this.table,
      Key: {
        [this.partitionKey]: primaryValue,
      },
      AttributeUpdates: items,
    };

    if (this.sortKey) {
      params.Key[this.sortKey] = sortValue;
    }

    const marshalled = marshalling(params);
    const command = new UpdateItemCommand(marshalled);

    return DB.runCommand(command)
      .then(() =>
        Object.keys(items));
  }

  async batchGet(pKeys, fieldsToGet = []) {
    let responses = [];

    // make sure batch size not exceed 100 items
    const sliced = pKeys.slice(0);

    while (sliced.length > 0) {
      const perBatch = sliced.splice(0, 100);
      const keys = perBatch.map((key) => ({
        [this.partitionKey]: key,
      }));

      const params = {
        RequestItems: {
          [this.table]: {
            Keys: keys,
          },
        },
      };

      if (fieldsToGet.length > 0) {
        params.RequestItems[this.table].ExpressionAttributeNames =
          fieldsToGet
            .reduce((acc, cur, idx) => ({
              ...acc,
              [`#p${idx}`]: cur,
            }), {});

        params.RequestItems[this.table].ProjectionExpression =
          Object.keys(params.RequestItems[this.table].ExpressionAttributeNames)
            .join(', ');
      }

      const marshalled = marshalling(params);
      const command = new BatchGetItemCommand(marshalled);

      const response = await DB.runCommand(command)
        .then((res) => {
          const unmarshalled = unmarshalling(res);
          return unmarshalled.Responses[this.table];
        });

      responses = responses.concat(response);
    }

    return responses;
  }

  async batchWrite(items = []) {
    let promises = [];

    const unprocessed = [];
    let processed = [];

    // BatchWriteItem supports 25 items per batch
    const batchSize = 25;
    const concurrency = 10;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const requestItems = batch
        .map((item) => ({
          PutRequest: {
            Item: item,
          },
        }));

      const marshalled = marshalling({
        RequestItems: {
          [this.table]: requestItems,
        },
      });

      const command = new BatchWriteItemCommand(marshalled);

      promises.push(DB.runCommand(command)
        .then((res) => {
          const unmarshalled = unmarshalling(res);

          let _items = (unmarshalled.UnprocessedItems || {})[this.table] || [];
          if (_items.length === 0) {
            processed = processed.concat(batch);
          } else {
            _items = _items.forEach((x) => {
              const item = x.PutRequest.Item;

              // store the unprocessed items
              unprocessed.push(item);

              // store the processed items
              const idx = batch.findIndex((k) =>
                k.faceId === item.faceId);

              if (idx >= 0) {
                processed = processed.concat(batch.splice(idx, 1));
              }
            });
          }
        })
        .catch((e) => {
          console.log('i', i, 'batch', batch);
          console.error(e);
        }));

      if (promises.length === concurrency) {
        await Promise.all(promises);
        promises = [];
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      promises = [];
    }

    return {
      processed,
      unprocessed,
    };
  }

  async batchDelete(pKeys) {
    const promises = [];

    // BatchWriteItem supports 25 items per batch
    const batchSize = 25;

    const cloned = pKeys.slice();
    while (cloned.length > 0) {
      const batch = cloned.splice(0, batchSize);

      const requestItems = batch
        .map((key) => ({
          DeleteRequest: {
            Key: {
              [this.partitionKey]: key,
            },
          },
        }));

      const marshalled = marshalling({
        RequestItems: {
          [this.table]: requestItems,
        },
      });
      const command = new BatchWriteItemCommand(marshalled);

      promises.push(DB.runCommand(command)
        .then(() =>
          batch));
    }

    return Promise.all(promises)
      .then((res) => ({
        deleted: res.flat(1),
      }));
  }

  async batchUpdate(items) {
    // cannot do BatchWriteItem as it overwrites the row completely.
    // use UpdateItem one by one instead.
    let promises = [];
    const cloned = items.slice();

    while (cloned.length > 0) {
      const item = cloned.shift();

      let keys = [];
      let expressionAttributeNames = [];
      let expressionAttributeValues = [];
      let updateExpression = [];

      Object.keys(item)
        .forEach((name, idx) => {
          if (name === this.partitionKey || name === this.sortKey) {
            keys.push({
              [name]: item[name],
            });
            return;
          }
          expressionAttributeNames.push({
            [`#k${idx}`]: name,
          });
          expressionAttributeValues.push({
            [`:v${idx}`]: item[name],
          });
          updateExpression.push(
            `#k${idx} = :v${idx}`
          );
        });

      // nothing to update, ignore item
      if (keys.length === 0 || updateExpression.length === 0) {
        continue;
      }

      keys = keys
        .reduce((a0, c0) => ({
          ...a0,
          ...c0,
        }), {});
      expressionAttributeNames = expressionAttributeNames
        .reduce((a0, c0) => ({
          ...a0,
          ...c0,
        }), {});
      expressionAttributeValues = expressionAttributeValues
        .reduce((a0, c0) => ({
          ...a0,
          ...c0,
        }), {});
      updateExpression = updateExpression
        .join(', ');
      updateExpression = `SET ${updateExpression}`;

      const marshalled = marshalling({
        TableName: this.table,
        Key: keys,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        UpdateExpression: updateExpression,
      });
      const command = new UpdateItemCommand(marshalled);

      promises.push(DB.runCommand(command)
        .then(() =>
          item[this.partitionKey]));
    }

    promises = await Promise.all(promises);

    return {
      updated: promises,
    };
  }

  async batchUpdateWithConditions(items, conditions) {
    if (items.length !== conditions.length) {
      throw new M2CException('mismatch length of items and conditions');
    }

    const updated = [];

    let promises = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const condition = conditions[i];

      let keys = [];
      let expressionAttributeNames = [];
      let expressionAttributeValues = [];
      let updateExpression = [];

      Object.keys(item)
        .forEach((name, idx) => {
          if (name === this.partitionKey || name === this.sortKey) {
            keys.push({
              [name]: item[name],
            });
            return;
          }
          expressionAttributeNames.push({
            [`#${name}`]: name,
          });
          expressionAttributeValues.push({
            [`:${name}`]: item[name],
          });
          updateExpression.push(
            `#${name} = :${name}`
          );
        });

      // nothing to update, ignore item
      if (keys.length === 0 || updateExpression.length === 0) {
        continue;
      }

      keys = keys
        .reduce((a0, c0) => ({
          ...a0,
          ...c0,
        }), {});
      expressionAttributeNames = expressionAttributeNames
        .reduce((a0, c0) => ({
          ...a0,
          ...c0,
        }), {});
      expressionAttributeValues = expressionAttributeValues
        .reduce((a0, c0) => ({
          ...a0,
          ...c0,
        }), {});
      updateExpression = updateExpression
        .join(', ');
      updateExpression = `SET ${updateExpression}`;

      let marshalled = {
        TableName: this.table,
        Key: keys,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        UpdateExpression: updateExpression,
        ReturnValues: 'ALL_NEW',
      };

      if (condition !== undefined && condition.length > 0) {
        marshalled.ConditionExpression = condition;
      }

      marshalled = marshalling(marshalled);
      console.log('marshalled', JSON.stringify(marshalled, null, 2));

      const command = new UpdateItemCommand(marshalled);

      promises.push(DB.runCommand(command)
        .then((res) => {
          const unmarshalled = unmarshalling(res);
          if (unmarshalled.Attributes) {
            updated.push(unmarshalled.Attributes);
          }
          return unmarshalled.Attributes;
        })
        .catch((e) => {
          if (e.name === 'ConditionalCheckFailedException') {
            return undefined;
          }
          throw e;
        }));

      // limit it to 20 requests at once
      if (promises.length >= 20) {
        await Promise.all(promises);
        promises = [];
      }
    }

    // wait for the remaining
    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return updated;
  }

  async batchDeleteWithConditions(keys, conditions) {
    if (keys.length !== conditions.length) {
      throw new M2CException('mismatch length of keys and conditions');
    }

    const deleted = [];

    let promises = [];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const condition = conditions[i];

      let marshalled = {
        TableName: this.table,
        Key: {
          [this.partitionKey]: key,
        },
        ReturnValues: 'ALL_OLD',
      };

      if (condition !== undefined && condition.length > 0) {
        marshalled.ConditionExpression = condition;
      }

      marshalled = marshalling(marshalled);
      console.log('marshalled', marshalled);

      const command = new DeleteItemCommand(marshalled);

      promises.push(DB.runCommand(command)
        .then((res) => {
          const unmarshalled = unmarshalling(res);
          if (unmarshalled.Attributes) {
            deleted.push(unmarshalled.Attributes);
          }
          return unmarshalled.Attributes;
        })
        .catch((e) => {
          if (e.name === 'ConditionalCheckFailedException') {
            return undefined;
          }
          throw e;
        }));

      // limit it to 20 requests at once
      if (promises.length >= 20) {
        await Promise.all(promises);
        promises = [];
      }
    }

    // wait for the remaining
    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return deleted;
  }

  static async runCommand(command) {
    const ddbClient = xraysdkHelper(new DynamoDBClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    return ddbClient.send(command);
  }

  static async queryCommand(params) {
    const marshalled = marshalling(params);
    const command = new QueryCommand(marshalled);

    return DB.runCommand(command)
      .then((res) => {
        const unmarshalled = unmarshalling(res);
        return unmarshalled.Items;
      });
  }
}

module.exports = DB;
