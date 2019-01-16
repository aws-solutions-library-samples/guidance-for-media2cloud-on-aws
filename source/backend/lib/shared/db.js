/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-vars */
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
    const {
      Table,
      PartitionKey,
    } = params;

    if (!Table || !PartitionKey) {
      throw new Error('missing parameters, Table or PartitionKey');
    }

    this.$table = Table;
    this.$partitionKey = PartitionKey;
  }

  /* eslint-disable class-methods-use-this */
  get instance() {
    return new AWS.DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
    });
  }
  /* eslint-enable class-methods-use-this */

  get table() {
    return this.$table;
  }

  get partition() {
    return this.$partitionKey;
  }

  /**
   * @function normalizeFileName
   * @description normalize the file name to S3-friendly filename
   * @param {string} name
   */
  static normalizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  }

  /**
   * @function update
   * @description update or create DB entry
   * @param {string} key - partition key
   * @param {object} value - attributes
   */
  async update(key, value) {
    try {
      /* merge the record first */
      const original = await this.fetch(key);

      /* run deepmerge to merge records */
      let merged = (() => {
        const emptyTarget = (val) => {
          if (Array.isArray(val)) {
            return [];
          }
          return {};
        };

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

        return DeepMerge(original, value, { arrayMerge: combineMerge });
      })();

      /* make sure no paritionKey is present in the attributes */
      delete merged[this.partition];

      /* IMPORTANT: manually merge attribute(s) that are Array type, the logic below */
      /* only handles the top level. Should do it recursively. */
      const arrayAttribNames = Object.keys(original).filter(x => Array.isArray(original[x]));

      arrayAttribNames.forEach((x) => {
        if (Array.isArray(value[arrayAttribNames])) {
          const unique = new Set(value[arrayAttribNames].concat(original[arrayAttribNames]));
          merged[arrayAttribNames] = Array.from(unique);
        }
      });

      /* now, run sanitizeJson to avoid xss attack before we save to db */
      merged = X.sanitizeJson(merged);
      process.env.ENV_QUIET || console.log(`original: ${JSON.stringify(original, null, 2)}\nmerged: ${JSON.stringify(merged, null, 2)}`);

      const params = {
        TableName: this.table,
        Key: {},
        AttributeUpdates: {},
      };

      params.Key[this.partition] = key;

      Object.keys(merged).forEach((x) => {
        params.AttributeUpdates[x] = { Action: 'PUT', Value: merged[x] };
      });
      process.env.ENV_QUIET || console.log(`params: ${JSON.stringify(params, null, 2)}`);

      const response = await this.instance.update(params).promise();

      return response;
    } catch (e) {
      e.message = `update(${key}): ${e.message}`;
      process.env.ENV_QUIET || console.error(e);
      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }

  /**
   * @function scan
   * @description scan all entries from DB
   */
  async scan() {
    try {
      let items = [];
      let moreItems = true;

      const params = {
        TableName: this.table,
      };

      while (moreItems) {
        /* eslint-disable no-await-in-loop */
        const {
          Items,
          LastEvaluatedKey,
        } = await this.instance.scan(params).promise();
        /* eslint-disable no-await-in-loop */

        items = items.concat(Items);

        if (LastEvaluatedKey) {
          params.ExclusiveStartKey = LastEvaluatedKey;
        } else {
          moreItems = false;
        }
      }

      return items;
    } catch (e) {
      e.message = `scan: ${e.message}`;
      process.env.ENV_QUIET || console.error(e);

      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }

  /**
   * @function fetch
   * @description query a specific db entry
   * @param {string} key - partition key
   */
  async fetch(key) {
    try {
      const params = {
        TableName: this.table,
        ExpressionAttributeNames: {
          '#key': this.partition,
        },
        ExpressionAttributeValues: {
          ':value': key,
        },
        KeyConditionExpression: '#key = :value',
      };

      const response = await this.instance.query(params).promise();

      const {
        Items,
        Count,
      } = response;

      return (!Count) ? {} : Items[0];
    } catch (e) {
      e.message = `fetch(${key}): ${e.message}`;
      process.env.ENV_QUIET || console.error(e);

      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }

  async purge(key) {
    try {
      const params = {
        TableName: this.table,
        Key: {},
      };

      params.Key[this.partition] = key;

      await this.instance.delete(params).promise();

      return key;
    } catch (e) {
      e.message = `purge(${key}): ${e.message}`;
      process.env.ENV_QUIET || console.error(e);

      throw (e instanceof DBError) ? e : new DBError(e);
    }
  }
}

module.exports = {
  DB,
  DBError,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    DB,
    DBError,
  });
