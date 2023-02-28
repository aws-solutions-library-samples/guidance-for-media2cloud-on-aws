// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const AmazonConnection = require('aws-elasticsearch-connector');
const {
  Client,
} = require('@elastic/elasticsearch');
const Environment = require('../environment');
const AnalysisTypes = require('../analysisTypes');
const MAPPINGS_INGEST = require('./mappings/ingest');
const MAPPINGS_ANALYSIS = require('./mappings/analysis');
const {
  pause,
} = require('../retry');

const DOMAIN_ENDPOINT = Environment.Elasticsearch.DomainEndpoint;
/* exception types */
const EXCEPTION_RESOURCE_ALREADY_EXISTS = 'resource_already_exists_exception';
const EXCEPTION_INDEX_NOT_FOUND = 'index_not_found_exception';
const EXCEPTION_DOCUMENT_MISSING = 'document_missing_exception';
const EXCEPTION_NOT_FOUND = 'not_found';

/* available indices */
const INDEX_INGEST = 'ingest';
const INDICES = [
  INDEX_INGEST,
  AnalysisTypes.Rekognition.Celeb,
  AnalysisTypes.Rekognition.Face,
  AnalysisTypes.Rekognition.FaceMatch,
  AnalysisTypes.Rekognition.Label,
  AnalysisTypes.Rekognition.Moderation,
  AnalysisTypes.Rekognition.Person,
  AnalysisTypes.Rekognition.Text,
  AnalysisTypes.Rekognition.Segment,
  AnalysisTypes.Rekognition.CustomLabel,
  AnalysisTypes.Transcribe,
  AnalysisTypes.Comprehend.Keyphrase,
  AnalysisTypes.Comprehend.Entity,
  AnalysisTypes.Comprehend.CustomEntity,
  AnalysisTypes.Comprehend.Sentiment,
  AnalysisTypes.Textract,
];
/* default settings */
const DEFAULT_AGGREGATION_SIZE = 10;
const DEFAULT_PAGESIZE = 20;

class Indexer {
  constructor(endpoint = DOMAIN_ENDPOINT) {
    if (!endpoint) {
      throw new Error('endpoint not specified');
    }
    this.$client = new Client({
      node: `https://${endpoint}`,
      ...AmazonConnection(new AWS.Config({
        ...(new AWS.EnvironmentCredentials('AWS')),
      })),
    });
  }

  get client() {
    return this.$client;
  }

  static getIndices() {
    return INDICES;
  }

  static getMapping(name) {
    if (!name) {
      throw new Error('index name not specified');
    }
    if (name === INDEX_INGEST) {
      return MAPPINGS_INGEST;
    }
    if (INDICES.indexOf(name) >= 0) {
      return MAPPINGS_ANALYSIS;
    }
    throw new Error(`index name ${name} not found`);
  }

  static parseIndexDescription(data) {
    /* https://www.elastic.co/guide/en/elasticsearch/reference/7.10/cat-indices.html */
    /* health | status | index | uuid | pri |
    | rep | docs.count | docs.deleted | store.size | pri.store.size */
    return data.split('\n')
      .filter(x => x)
      .reduce((a0, c0) => {
        const [
          health,
          status,
          index,
          uuid,
          pri,
          rep,
          docsCount,
          docsDeleted,
          storeSize,
          priStoreSize,
        ] = c0.split(' ').filter(x => x);
        return a0.concat({
          health,
          status,
          index,
          uuid,
          pri: Number(pri),
          rep: Number(rep),
          docsCount: Number(docsCount),
          docsDeleted: Number(docsDeleted),
          storeSize,
          priStoreSize,
        });
      }, []);
  }

  async describeIndex(name) {
    if (!name) {
      throw new Error('index name not specified');
    }
    return this.client.cat.indices({
      index: name,
    }).then((res) =>
      Indexer.parseIndexDescription(res.body));
  }

  async describeAllIndices() {
    return this.client.cat.indices({})
      .then((res) =>
        Indexer.parseIndexDescription(res.body));
  }

  async createIndex(name) {
    if (!name) {
      throw new Error('index name not specified');
    }
    const body = Indexer.getMapping(name);
    /* retry logic */
    let tries = 5;
    let response;
    do {
      response = await this.client.indices.create({
        index: name,
        body,
      }).catch((e) =>
        e);

      if (!(response instanceof Error)) {
        return response;
      }
      if (response.body.error.type === EXCEPTION_RESOURCE_ALREADY_EXISTS) {
        console.log(`index '${name}' already exists`);
        return undefined;
      }
      await pause(400);
    } while ((tries--) > 0);

    throw response;
  }

  async batchCreateIndices(indices = INDICES) {
    const batched = indices.slice();
    const succeeded = [];
    const failed = [];
    while (batched.length) {
      const name = batched.shift();
      await this.createIndex(name)
        .then(() =>
          succeeded.push(name))
        .catch((e) =>
          failed.push(((e.body || {}).error || {}).reason));
    }
    if (failed.length) {
      throw new Error(failed.join('\n'));
    }
    return succeeded;
  }

  async deleteIndex(name) {
    if (!name) {
      throw new Error('index name not specified');
    }
    return this.client.indices.delete({
      index: name,
    }).catch((e) => {
      if (e.body.error.type === EXCEPTION_INDEX_NOT_FOUND) {
        console.log(`index '${name}' not exist. nothing to delete.`);
        return undefined;
      }
      throw e;
    });
  }

  async batchDeleteIndices(indices = INDICES) {
    const batched = indices.slice();
    const succeeded = [];
    const failed = [];
    while (batched.length) {
      const name = batched.shift();
      await this.deleteIndex(name)
        .then(() =>
          succeeded.push(name))
        .catch((e) =>
          failed.push(((e.body || {}).error || {}).reason));
    }
    if (failed.length) {
      throw new Error(failed.join('\n'));
    }
    return succeeded;
  }

  async updateSettings(name, settings) {
    if (!name || !settings) {
      throw new Error('index name or settings not specified');
    }
    return this.client.indices.putSettings({
      index: name,
      body: settings,
    }).catch((e) => {
      throw e;
    });
  }

  async getSettings(name) {
    if (!name) {
      throw new Error('index name not specified');
    }
    return this.client.indices.getSettings({
      index: name,
      include_defaults: true,
    }).catch((e) => {
      throw e;
    });
  }

  async index(name, id, body) {
    if (!name || !id || !body) {
      throw new Error('name, id, or body not specified');
    }
    return this.client.index({
      index: name,
      id,
      body,
      refresh: true,
    });
  }

  async update(name, id, doc) {
    if (!name || !id || !doc) {
      throw new Error('name, id, or doc not specified');
    }
    return this.client.update({
      index: name,
      id,
      body: {
        doc,
      },
      refresh: true,
    });
  }

  async delete(name, id) {
    if (!name || !id) {
      throw new Error('name or id not specified');
    }
    return this.client.delete({
      index: name,
      id,
      refresh: true,
    });
  }

  async search(query) {
    if (!query) {
      throw new Error('missing query');
    }
    return this.client.search(query);
  }

  async aggregate(name, size = DEFAULT_AGGREGATION_SIZE) {
    return this.client.search({
      index: name,
      body: {
        size: 0,
        aggs: {
          [name]: {
            nested: {
              path: 'data',
            },
            aggs: {
              [name]: {
                terms: {
                  field: 'data.name.keyword',
                  size,
                },
              },
            },
          },
        },
      },
    }).then((res) =>
      res.body.aggregations);
  }

  async getDocument(name, id) {
    if (!name || !id) {
      throw new Error('name or id not specified');
    }
    return this.client.get({
      id,
      index: name,
    }).then((res) =>
      res.body._source);
  }

  async indexDocument(name, id, doc) {
    return this.update(name, id, doc)
      .catch((e) => {
        if (((e.body || {}).error || {}).type === EXCEPTION_DOCUMENT_MISSING) {
          return this.index(name, id, doc);
        }
        throw e;
      });
  }

  async deleteDocument(name, id) {
    return this.delete(name, id)
      .catch((e) => {
        if ((e.body || {}).result === EXCEPTION_NOT_FOUND) {
          return undefined;
        }
        throw e;
      });
  }

  async searchDocument(params) {
    if (!(params || {}).index) {
      throw new Error('index not specified');
    }
    const includes = [
      'data.name',
      'data.timecodes',
      'data.model', /* for customlabel models */
      'data.page', /* for textract */
    ];
    const size = Number(params.pagesize || DEFAULT_PAGESIZE);
    const from = Number(params.token || 0);
    const operator = params.exact ? 'AND' : 'OR';
    const term = params.term;
    const query = {
      index: params.index,
      body: {
        from,
        size,
        _source: [
          'type',
        ],
        query: {
          bool: {
            must: [
              {
                nested: {
                  path: 'data',
                  query: {
                    match: {
                      'data.name': {
                        query: term,
                        operator,
                      },
                    },
                  },
                  inner_hits: {
                    _source: {
                      includes,
                    },
                  },
                },
              },
            ],
          },
        },
      },
    };
    return this.search(query)
      .then((res) =>
        res.body.hits);
  }
}

module.exports = Indexer;
