// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('aws-sdk');
  }
})();
const Environment = require('./environment');
const {
  mxCommonUtils,
} = require('./mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

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
      // 'SortKey',
    ].filter(x => params[x] === undefined);

    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    this.$table = params.Table;
    this.$partitionKey = params.PartitionKey;

    this.$sortKey = params.SortKey;
    this.$sortKeyType = undefined;

    this.$instance = new AWS.DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
  }

  static get Constants() {
    return {
      PageSize: 20,
    };
  }

  get [Symbol.toStringTag]() {
    return 'DB';
  }

  get instance() {
    return this.$instance;
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

  get sortKeyType() {
    return this.$sortKeyType;
  }

  set sortKeyType(val) {
    this.$sortKeyType = val;
  }

  /**
   * @function update
   * @description update or create DB entry
   * @param {string} primaryValue - partition key value
   * @param {string} [sortValue] - sort key value
   * @param {object} attributes - attributes
   * @param {boolean} [merge] - default to merge entry
   */
  async update(primaryValue, sortValue, attributes, merge = true) {
    const original = (merge) ? await this.fetch(primaryValue, sortValue) : {};
    const merged = X.sanitizeJson(X.cleansing(X.merge(original, attributes), {
      array: false, // don't remove empty array
      object: false, // don't remove empty object
    }));

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

    Object.keys(merged).forEach((x) => {
      params.AttributeUpdates[x] = {
        Action: 'PUT',
        Value: merged[x],
      };
    });

    return this.instance.update(params).promise();
  }

  /**
   * @function scan
   * @description scan all entries from DB
   */
  async scan(filter) {
    let items = [];
    let response;

    do {
      response = await this.instance.scan(X.cleansing({
        TableName: this.table,
        ScanFilter: filter,
        ExclusiveStartKey: (response || {}).LastEvaluatedKey,
      })).promise();
      items = items.concat(response.Items);
    } while ((response || {}).LastEvaluatedKey);

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
    ].filter(x => data[x] === undefined);

    if (missing.length) {
      throw new Error(`scanIndex missing ${missing.join(', ')}`);
    }

    const keyConditions = {
      [data.Key]: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [
          data.Value,
        ],
      },
    };

    const queryFilter = (data.Conditions || []).reduce((a0, c0) => ({
      ...a0,
      [c0.Key]: {
        ComparisonOperator: c0.ComparisonOperator || 'EQ',
        AttributeValueList: [
          c0.Value,
        ],
      },
    }), undefined);

    const params = {
      TableName: this.table,
      IndexName: data.Name,
      KeyConditions: keyConditions,
      QueryFilter: queryFilter,
      ScanIndexForward: !!(data.Ascending),
      Limit: Number.parseInt(data.PageSize || DB.Constants.PageSize, 10),
      ExclusiveStartKey: data.Token && JSON.parse(Buffer.from(data.Token, 'base64').toString()),
    };

    const {
      Items,
      LastEvaluatedKey,
    } = await this.instance.query(params).promise();

    return {
      Items,
      NextToken: LastEvaluatedKey && Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64'),
    };
  }

  /**
   * @function fetch
   * @description query a specific db entry
   * @param {string} primaryValue - partition key value
   * @param {string} [sortValue] - sort key value
   * @param {string} [projection] - selected field(s) to return
   */
  async fetch(primaryValue, sortValue, projection) {
    if (this.sortKey && this.sortKeyType === undefined) {
      await this.describe();
    }

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
      params.KeyConditionExpression = (this.sortKeyType === 'string')
        ? `${params.KeyConditionExpression} and begins_with(#x1, :v1)`
        : `${params.KeyConditionExpression} and #x1 >= :v1`;
    }

    if (projection) {
      let names = Array.isArray(projection) ? projection : [projection];
      names = names.filter(x =>
        x !== this.partitionKey && x !== this.sortKey);

      params.ExpressionAttributeNames = names.reduce((acc, cur, idx) =>
        Object.assign(acc, {
          [`#p${idx}`]: cur,
        }), params.ExpressionAttributeNames);

      params.ProjectionExpression =
        Object.keys(params.ExpressionAttributeNames).join(', ');
    }

    const response = await this.instance.query(params).promise();
    return (!response.Count) ? {} : response.Items.shift();
  }

  /**
   * @function purge
   * @description delete entry from db
   * @param {string} primaryValue - partition key value
   * @param {string} [sortValue] - sort key value
   */
  async purge(primaryValue, sortValue) {
    const params = {
      TableName: this.table,
      Key: {
        [this.partitionKey]: primaryValue,
      },
    };

    if (this.sortKey) {
      params.Key[this.sortKey] = sortValue;
    }

    return this.instance.delete(params).promise();
  }

  /**
   * @function describe
   * @description find out the primary and sort key attribute
   */
  async describe() {
    const instance = new AWS.DynamoDB({
      apiVersion: '2012-08-10',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    const response = await instance.describeTable({
      TableName: this.table,
    }).promise();

    const {
      Table: {
        AttributeDefinitions,
      },
    } = response;

    if (this.sortKey) {
      const sortKey = AttributeDefinitions.find(x =>
        x.AttributeName === this.sortKey);

      this.sortKeyType = (sortKey.AttributeType === 'S')
        ? 'string'
        : 'number';
    }

    return response;
  }

  async dropColumns(primaryValue, sortValue, attributes) {
    let items = Array.isArray(attributes) ? attributes : [attributes];
    /* #1: remove primary and sort key from the list */
    items = items.filter(x =>
      x !== this.partitionKey && x !== this.sortKey);

    if (!items.length) {
      return items;
    }

    /* #2: build the update list */
    items = items.reduce((acc, cur) =>
      Object.assign(acc, {
        [cur]: {
          Action: 'DELETE',
        },
      }), {});

    await this.instance.update({
      TableName: this.table,
      Key: {
        [this.partitionKey]: primaryValue,
        [this.sortKey]: sortValue,
      },
      AttributeUpdates: items,
    }).promise();

    return Object.keys(items);
  }
}

module.exports = DB;
