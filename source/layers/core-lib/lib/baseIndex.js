/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
const AWS = require('aws-sdk');
const AmazonConnection = require('aws-elasticsearch-connector');

const {
  Client,
} = require('@elastic/elasticsearch');

const {
  IndexError,
} = require('./error');

const {
  StateData,
} = require('./stateData');

const {
  Environment,
} = require('./index');

class MyAmazonConnection extends AmazonConnection {
  request(params, callback) {
    return super.request(params, callback);
  }
}

/**
 * @class BaseIndex
 */
class BaseIndex {
  constructor(endpoint, name, type) {
    const host = endpoint || BaseIndex.Constants.Endpoint;
    if (!host) {
      throw new IndexError('missing domain endpoint');
    }

    this.$indexName = name || BaseIndex.Constants.Index.Name;
    this.$docType = type || BaseIndex.Constants.Index.Type;

    const credentials = new AWS.EnvironmentCredentials('AWS');
    this.$client = new Client({
      node: `https://${host}`,
      Connection: MyAmazonConnection,
      awsConfig: {
        credentials,
      },
    });
  }

  static get Constants() {
    return {
      DefaultPageSize: 20,
      Endpoint: Environment.Elasticsearch.DomainEndpoint,
      Index: {
        Name: Environment.Elasticsearch.IndexName,
        Type: 'media',
      },
      Settings: {
        /* allows elastic to index 10M fields */
        TotalFields: 10 * 1000 * 1000,
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'BaseIndex';
  }

  get indexName() {
    return this.$indexName;
  }

  get docType() {
    return this.$docType;
  }

  get client() {
    return this.$client;
  }

  /**
   * @function indexResults
   * @description pure function, sub-class to implement
   * @param {*} args
   */
  async indexResults(...args) {
    throw new IndexError('BaseIndex.indexResults not impl');
  }

  async update(uuid, doc) {
    return this.client.update({
      index: this.indexName,
      type: this.docType,
      id: uuid,
      body: {
        doc,
      },
      refresh: true,
    });
  }

  async index(uuid, doc) {
    return this.client.index({
      index: this.indexName,
      type: this.docType,
      id: uuid,
      body: doc,
      refresh: true,
    });
  }

  /**
   * @async
   * @function indexDocument
   * @description try update first. If doc doesn't exist, do index.
   * @param {string} uuid - uuid
   * @param {object} doc - json document to be indexed
   */
  async indexDocument(uuid, doc) {
    const sanitized = BaseIndex.sanitize(doc);
    return this.update(uuid, sanitized).catch(() =>
      this.index(uuid, sanitized));
  }

  /**
   * @async
   * @function deleteDocument
   * @description delete document by uuid
   * this function never throws error
   * @param {string} [uuid] - if not specified, delete this uuid
   */
  async deleteDocument(uuid) {
    return this.client.delete({
      index: this.indexName,
      type: this.docType,
      id: uuid,
      refresh: true,
    }).catch((e) => {
      throw new Error(`${this.indexName} ${this.docType} ${uuid} - ${e.message || e.code || 'unknown error'}`);
    });
  }

  /**
   * @async
   * @function searchDocument
   * @description search and sort results with page size default to 20
   * @param {*} params
   * @param {string} params.query - search team
   * @param {number} [params.pageSize] - specify items to return
   * @param {number} [params.token] - starting cursor
   * @param {boolean} [params.exact] - exact match or wildcard
   * @returns {Object} results
   * @return {Array} results.uuids - array of uuids
   * @return {number} [results.token] - next token
   */
  async searchDocument(params) {
    const size = Number.parseInt(params.pageSize || BaseIndex.Constants.DefaultPageSize, 10);
    const from = Number.parseInt(params.token || 0, 10);
    const operator = params.exact ? 'AND' : 'OR';

    const response = await this.client.search({
      index: this.indexName,
      body: {
        from,
        size,
        _source: {
          includes: [
            'timestamp',
          ],
        },
        sort: [{
          timestamp: {
            order: 'desc',
          },
        }],
        query: {
          query_string: {
            default_operator: operator,
            query: params.query,
          },
        },
      },
    });

    // eslint-disable-next-line
    const uuids = response.body.hits.hits.map(x => x._id);
    return {
      uuids,
      token: from + uuids.length,
      total: response.body.hits.total,
    };
  }

  async createIndex(name) {
    return this.client.indices.create({
      index: name || this.indexName,
      body: {
        settings: {
          'index.mapping.total_fields.limit': BaseIndex.Constants.Settings.TotalFields,
        },
      },
    });
  }

  async deleteIndex(name) {
    return this.client.indices.delete({
      index: name || this.indexName,
    }).catch((e) => {
      throw new Error(`${name || this.indexName} - ${e.message || e.code || 'unknown error'}`);
    });
  }

  async getDocument(uuid) {
    const response = await this.client.get({
      index: this.indexName,
      type: this.docType,
      id: uuid,
    }).catch((e) => {
      throw new Error(`${this.indexName} ${this.docType} ${uuid} - ${e.message || e.code || 'unknown error'}`);
    });
    return response.body._source; // eslint-disable-line
  }

  /**
   * @function sanitize
   * @description force all values to be 'string' type to avoid mapper_parsing_exception
   * @param {Object} doc
   */
  static sanitize(doc) {
    const parsed = Object.assign(doc);
    BaseIndex.tranverse(parsed, (k, v, obj) => {
      if (BaseIndex.primitive(v) && k !== 'timestamp') {
        obj[k] = v.toString(); // eslint-disable-line
      }
    });
    return parsed;
  }

  static primitive(val) {
    switch (typeof val) {
      case 'boolean':
      case 'number':
      case 'string':
      case 'undefined':
      case 'symbol':
        return true;
      default:
        return (val === null);
    }
  }

  static tranverse(o, fn) {
    // eslint-disable-next-line
    for (let i in o) {
      fn(i, o[i], o);
      if (o[i] !== undefined && o[i] !== null && typeof o[i] === 'object') {
        BaseIndex.tranverse(o[i], fn);
      }
    }
  }
}

module.exports = {
  BaseIndex,
};
