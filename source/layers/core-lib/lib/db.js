/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-vars */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const DeepMerge = require('deepmerge');
const AWS = require('aws-sdk');

const {
  mxCommonUtils,
} = require('./mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

/**
 * @class DBError
 */
class DBError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, DBError);
  }
}

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
      throw new DBError(`missing ${missing.join(', ')}`);
    }

    this.$table = params.Table;
    this.$partitionKey = params.PartitionKey;

    this.$sortKey = params.SortKey;
    this.$sortKeyType = undefined;

    this.$instance = new AWS.DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
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
    try {
      let original = {};
      /* run deepmerge to merge records */
      let merged = await (async () => {
        if (!merge) {
          return Object.assign({}, attributes);
        }

        const emptyTarget = val =>
          ((Array.isArray(val)) ? [] : {});

        const clone = (val, options) =>
          DeepMerge(emptyTarget(val), val, options);

        const combineMerge = (target, source, options) => {
          const destination = target.slice();

          source.forEach((e, i) => {
            if (typeof destination[i] === 'undefined') {
              const cloneRequested = options.clone !== false;
              const shouldClone = cloneRequested && options.isMergeableObject(e);

              destination[i] = shouldClone ? clone(e, options) : e;
            } else if (options.isMergeableObject(e)) {
              destination[i] = DeepMerge(target[i], e, options);
            } else if (target.indexOf(e) === -1) {
              destination.push(e);
            }
          });

          return destination;
        };

        /* merge the record first */
        original = await this.fetch(primaryValue, sortValue);

        return DeepMerge(original, attributes, { arrayMerge: combineMerge });
      })();

      /* make sure no paritionKey is present in the attributes */
      delete merged[this.partitionKey];
      delete merged[this.sortKey];

      /* IMPORTANT: manually merge attribute(s) that are Array type, the logic below */
      /* only handles the top level. Should do it recursively. */
      const arrayAttribNames = Object.keys(original).filter(x =>
        Array.isArray(original[x]));

      arrayAttribNames.forEach((x) => {
        if (Array.isArray(attributes[arrayAttribNames])) {
          const unique = new Set(attributes[arrayAttribNames].concat(original[arrayAttribNames]));
          merged[arrayAttribNames] = Array.from(unique);
        }
      });

      /* now, run sanitizeJson to avoid xss attack before we save to db */
      merged = X.sanitizeJson(merged);

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

      const response = await this.instance.update(params).promise();

      return response;
    } catch (e) {
      e.message = `update(${primaryValue}): ${e.message}`;
      console.error(e);
      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }

  /**
   * @function scan
   * @description scan all entries from DB
   */
  async scan(filter) {
    try {
      const params = {
        TableName: this.table,
      };

      if (filter) {
        params.ScanFilter = filter;
      }

      let items = [];
      let response;

      do {
        response = await this.instance.scan(params).promise();

        items = items.concat(response.Items);
        if (response.LastEvaluatedKey) {
          params.ExclusiveStartKey = response.LastEvaluatedKey;
        }
      } while ((response || {}).LastEvaluatedKey);

      return items;
    } catch (e) {
      e.message = `scan: ${e.message}`;
      console.error(e);

      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }

  /**
   * @function scanIndex
   * @description scan GSI index
   * @param {*} data
   * @param {string} data.Name - GSI index name
   * @param {string} data.Key - GSI index partition key
   * @param {string} data.Value - GSI index partition value
   * @param {string} [data.Token] - base64 encoded ExclusiveStartKey used to continue from last scan
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
      // 'Token',
      // 'PageSize',
      // 'Ascending',
    ].filter(x => data[x] === undefined);

    if (missing.length) {
      throw new DBError(`scanIndex missing ${missing.join(', ')}`);
    }

    const params = {
      TableName: this.table,
      IndexName: data.Name,
      ExpressionAttributeNames: {
        '#x0': data.Key,
      },
      ExpressionAttributeValues: {
        ':v0': data.Value,
      },
      KeyConditionExpression: '#x0 = :v0',
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
    try {
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
    } catch (e) {
      e.message = `fetch(${primaryValue}): ${e.message}`;
      console.error(e);

      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }

  /**
   * @function purge
   * @description delete entry from db
   * @param {string} primaryValue - partition key value
   * @param {string} [sortValue] - sort key value
   */
  async purge(primaryValue, sortValue) {
    try {
      const params = {
        TableName: this.table,
        Key: {
          [this.partitionKey]: primaryValue,
        },
      };

      if (this.sortKey) {
        params.Key[this.sortKey] = sortValue;
      }

      await this.instance.delete(params).promise();

      return primaryValue;
    } catch (e) {
      e.message = `purge(${primaryValue}): ${e.message}`;
      console.error(e);

      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }

  /**
   * @function describe
   * @description find out the primary and sort key attribute
   */
  async describe() {
    const instance = new AWS.DynamoDB({
      apiVersion: '2012-08-10',
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

module.exports = {
  DB,
  DBError,
};
