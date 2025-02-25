// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  fromEnv,
} = require('@aws-sdk/credential-providers');
const {
  Client,
} = require('@opensearch-project/opensearch');
const {
  AwsSigv4Signer,
} = require('@opensearch-project/opensearch/aws');
const Environment = require('../environment');
const MAPPINGS_CONTENT = require('./mappings/content');
const {
  M2CException,
} = require('../error');

const REGION = process.env.AWS_REGION;
const DOMAIN_ENDPOINT = Environment.Elasticsearch.DomainEndpoint;
const USE_OPENSEARCH_SERVERLESS = Environment.Elasticsearch.UseOpenSearchServerless;
/* exception types */
const EXCEPTION_RESOURCE_ALREADY_EXISTS = 'resource_already_exists_exception';
const EXCEPTION_INDEX_NOT_FOUND = 'index_not_found_exception';
const EXCEPTION_DOCUMENT_MISSING = 'document_missing_exception';
const EXCEPTION_NOT_FOUND = 'not_found';
const OSS_EXCEPTION_DOCUMENT_MISSING = 'document_missing_in_index_exception';

/* available indices */
const INDEX_CONTENT = 'content';
const INDICES = [
  INDEX_CONTENT,
];

/* AI/ML fields */
const AIML_FIELDS = Object.keys(MAPPINGS_CONTENT.mappings.properties)
  .filter((x) =>
    MAPPINGS_CONTENT.mappings.properties[x].properties !== undefined
    && MAPPINGS_CONTENT.mappings.properties[x].properties.name !== undefined
    && MAPPINGS_CONTENT.mappings.properties[x].properties.timecodes !== undefined);

/* ingest fields */
const INGEST_FIELDS = Object.keys(MAPPINGS_CONTENT.mappings.properties)
  .filter((x) =>
    !AIML_FIELDS.includes(x));

/* default settings */
const DEFAULT_AGGREGATION_SIZE = 10;
const DEFAULT_PAGESIZE = 20;
const DEFAULT_TIMEOUT = 60;

/* pause function */
async function pause(msecs = 400) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, msecs);
  });
}

class Indexer {
  constructor(
    node = DOMAIN_ENDPOINT,
    useOpenSearchServerless = USE_OPENSEARCH_SERVERLESS
  ) {
    if (node) {
      const service = (useOpenSearchServerless)
        ? 'aoss'
        : 'es';

      const options = {
        maxRetries: 10,
        requestTimeout: DEFAULT_TIMEOUT * 1000,
      };

      this.$client = new Client({
        node,
        ...AwsSigv4Signer({
          service,
          region: REGION,
          getCredentials: async () =>
            fromEnv()(),
        }),
        ...options,
      });

      this.$useOpenSearchServerless = useOpenSearchServerless;
    }
  }

  get client() {
    return this.$client;
  }

  get useOpenSearchServerless() {
    return this.$useOpenSearchServerless;
  }

  static canUse() {
    return DOMAIN_ENDPOINT && DOMAIN_ENDPOINT.length > 0;
  }

  static getIndices() {
    return INDICES;
  }

  static getContentIndex() {
    return INDEX_CONTENT;
  }

  static getMapping(name) {
    if (!name) {
      throw new M2CException('index name not specified');
    }
    if (name === INDEX_CONTENT) {
      return MAPPINGS_CONTENT;
    }
    throw new M2CException(`index name ${name} not found`);
  }

  static getAnalysisFields() {
    return AIML_FIELDS;
  }

  static getIngestFields() {
    return INGEST_FIELDS;
  }

  async createIndex(name, mapping = undefined) {
    if (!Indexer.canUse()) {
      return undefined;
    }

    if (!name) {
      throw new M2CException('index name not specified');
    }

    let body = mapping;
    if (!body) {
      body = Indexer.getMapping(name);
    }
    if (body === undefined) {
      throw new M2CException('fail to find mapping');
    }

    const timeout = `${DEFAULT_TIMEOUT}s`;
    /* retry logic */
    let tries = 5;
    let response;
    do {
      response = await this.client.indices.create({
        index: name,
        body,
        timeout,
        master_timeout: timeout,
      }).catch((e) =>
        e);

      console.log(
        'index',
        name,
        'statusCode',
        response.statusCode,
        (response.body !== undefined)
          ? JSON.stringify(response.body.error, null, 2)
          : (response.meta !== undefined)
            ? JSON.stringify(response.meta, null, 2)
            : ''
      );

      if (!(response instanceof Error)) {
        return response;
      }
      if (response.statusCode === 401) {
        console.log(`${response.statusCode} - Unauthorized`);
        return undefined;
      }
      if (response.statusCode === 403) {
        console.log(`${response.statusCode} - Forbidden`);
        return undefined;
      }

      if (((response.body || {}).error || {}).type === EXCEPTION_RESOURCE_ALREADY_EXISTS) {
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
          failed.push(e.body.error.reason));
    }
    if (failed.length) {
      throw new M2CException(failed.join('\n'));
    }
    return succeeded;
  }

  async deleteIndex(name) {
    if (!Indexer.canUse()) {
      return undefined;
    }

    if (!name) {
      throw new M2CException('index name not specified');
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
          failed.push(e.body.error.reason));
    }
    if (failed.length) {
      throw new M2CException(failed.join('\n'));
    }
    return succeeded;
  }

  async updateSettings(name, settings) {
    if (!Indexer.canUse()) {
      throw new M2CException('Amazon OpenSearch is not configured');
    }

    if (!name || !settings) {
      throw new M2CException('index name or settings not specified');
    }

    return this.client.indices.putSettings({
      index: name,
      body: settings,
    }).catch((e) => {
      throw e;
    });
  }

  async getSettings(name) {
    if (!Indexer.canUse()) {
      throw new M2CException('Amazon OpenSearch is not configured');
    }

    if (!name) {
      throw new M2CException('index name not specified');
    }

    return this.client.indices.getSettings({
      index: name,
      include_defaults: true,
    }).catch((e) => {
      throw e;
    });
  }

  async getIndexMapping(name) {
    if (!Indexer.canUse()) {
      throw new M2CException('Amazon OpenSearch is not configured');
    }

    if (!name) {
      throw new M2CException('index name not specified');
    }

    return this.client.indices.getMapping({
      index: name,
    }).catch((e) => {
      throw e;
    });
  }

  async updateIndexMapping(name, mapping) {
    if (!Indexer.canUse()) {
      throw new M2CException('Amazon OpenSearch is not configured');
    }

    if (!name || !mapping) {
      throw new M2CException('index name or mapping not specified');
    }

    return this.client.indices.putMapping({
      index: name,
      body: mapping,
    }).catch((e) => {
      throw e;
    });
  }

  async index(name, id, body) {
    if (!Indexer.canUse()) {
      return {};
    }

    if (!name || !id || !body) {
      throw new M2CException('name, id, or body not specified');
    }

    const timeout = `${DEFAULT_TIMEOUT}s`;
    const options = {
      timeout,
    };
    if (!this.useOpenSearchServerless) {
      options.refresh = true;
    }

    return this.client.index({
      index: name,
      id,
      body,
      ...options,
    });
  }

  async update(name, id, doc) {
    if (!Indexer.canUse()) {
      return {};
    }

    if (!name || !id || !doc) {
      throw new M2CException('name, id, or doc not specified');
    }

    const timeout = `${DEFAULT_TIMEOUT}s`;
    const options = {
      timeout,
    };
    if (!this.useOpenSearchServerless) {
      options.refresh = true;
    }

    return this.client.update({
      index: name,
      id,
      body: {
        doc,
      },
      ...options,
    });
  }

  async delete(name, id) {
    if (!Indexer.canUse()) {
      return {};
    }

    if (!name || !id) {
      throw new M2CException('name or id not specified');
    }

    const options = {};
    if (!this.useOpenSearchServerless) {
      options.refresh = true;
    }

    return this.client.delete({
      index: name,
      id,
      ...options,
    });
  }

  async search(query) {
    if (!Indexer.canUse()) {
      return {};
    }

    if (!query) {
      throw new M2CException('missing query');
    }

    return this.client.search(query);
  }

  async aggregate(fields, size = DEFAULT_AGGREGATION_SIZE) {
    if (!Indexer.canUse()) {
      return {};
    }

    let names = fields;

    if (fields === undefined || fields.length === 0) {
      throw M2CException('missing fields');
    }

    if (!Array.isArray(names)) {
      names = names
        .split(',')
        .map((x) =>
          x.trim());
    }

    const aggs = names
      .reduce((a0, c0) => ({
        ...a0,
        [c0]: {
          terms: {
            field: `${c0}.name.keyword`,
            size,
          },
        },
      }), {});

    return this.client.search({
      index: INDEX_CONTENT,
      body: {
        size: 0,
        aggs,
      },
    }).then((res) =>
      res.body.aggregations);
  }

  async getDocument(name, id, fields = []) {
    if (!Indexer.canUse()) {
      return {};
    }

    if (!name || !id) {
      throw new M2CException('name or id not specified');
    }

    const params = {
      id,
      index: name,
    };

    if (fields.length > 0) {
      params._source_includes = fields.join(',');
    }

    return this.client.get(params)
      .then((res) =>
        res.body._source);
  }

  async getDocumentVersion(name, id) {
    if (!Indexer.canUse()) {
      return -1;
    }

    if (!name || !id) {
      throw new M2CException('name or id not specified');
    }

    /* if not found or error, return -1 */
    return this.client.get({
      id,
      index: name,
      _source: false,
    }).then((res) =>
      res.body._version || -1)
      .catch((e) =>
        -1);
  }

  async indexDocument(name, id, doc, forceWait = true) {
    let response = await this.update(name, id, doc)
      .catch((e) => {
        if (e.body.error.type === OSS_EXCEPTION_DOCUMENT_MISSING
          || e.body.error.type === EXCEPTION_DOCUMENT_MISSING) {
          return false;
        }
        throw e;
      });

    if (!response) {
      response = await this.index(name, id, doc);
    }

    if (!this.useOpenSearchServerless || !forceWait) {
      return response;
    }

    /* workaround: opensearch serverless doesn't support 'refresh' flag */
    /* and could have long latency before search is available */
    const version = response.body._version;
    const maxWait = 10 * 1000;
    let waitTime = 200;
    let count = 1;
    do {
      await pause(waitTime);
      waitTime *= 1.5;

      const queried = await this.getDocumentVersion(name, id);
      console.log(
        '== indexDocument',
        name,
        id,
        'version',
        version,
        'queried',
        queried,
        `[${count++}] ==`
      );

      if (queried === version) {
        break;
      }
    } while (maxWait > waitTime);

    return response;
  }

  async deleteDocument(name, id) {
    return this.delete(name, id)
      .catch((e) => {
        if (e.body.result === EXCEPTION_NOT_FOUND) {
          return undefined;
        }
        throw e;
      });
  }

  async searchDocument(params) {
    if (!(params || {}).index) {
      throw new M2CException('index not specified');
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

  async getAllDocuments(index, source = false) {
    if (!index) {
      throw new M2CException('index not specified');
    }
    const query = {
      index,
      body: {
        _source: !!(source),
        query: {
          match_all: {},
        },
      },
    };
    return this.search(query)
      .then((res) =>
        res.body.hits);
  }

  async msearch(query) {
    if (!Indexer.canUse()) {
      return {};
    }

    if (!query) {
      throw new M2CException('missing query');
    }

    return this.client.msearch(query);
  }

  async mget(query) {
    if (!Indexer.canUse()) {
      return {};
    }

    if (!query) {
      throw new M2CException('missing query');
    }

    return this.client.mget(query);
  }

  async dropFields(
    name,
    id,
    fields = []
  ) {
    if (!Indexer.canUse()) {
      return {};
    }

    let keys = fields;

    if (typeof keys === 'string') {
      keys = keys.split(',')
        .map((x) =>
          x.trim())
        .filter((x) =>
          x);
    }

    if (!Array.isArray(keys) || keys.length === 0) {
      throw new M2CException('invalid fields');
    }

    const removeScript = keys
      .map((key) =>
        `ctx._source.remove("${key}")`)
      .join(';');

    const timeout = `${DEFAULT_TIMEOUT}s`;
    const options = {
      timeout,
    };

    if (!this.useOpenSearchServerless) {
      options.refresh = true;
    }

    return this.client.update({
      index: name,
      id,
      body: {
        script: {
          source: removeScript,
          lang: 'painless',
        },
      },
      ...options,
    });
  }

  async dropAnalysisFields(
    name,
    id
  ) {
    return this.dropFields(
      name,
      id,
      AIML_FIELDS
    );
  }
}

module.exports = Indexer;
