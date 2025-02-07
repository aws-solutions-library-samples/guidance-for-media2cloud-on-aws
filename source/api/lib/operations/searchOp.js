// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Indexer,
  CommonUtils,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const MEDIA_TYPES = [
  'audio',
  'video',
  'image',
  'document',
];
const INDEX_CONTENT = 'content';

const DEFAULT_PAGESIZE = 30;
const COMPOUND_KEYWORDS = [
  'AND',
  'OR',
  'NOT',
];
const IGNORED_LIST = [
  'type',
  'key',
  'bucket',
];

/* eslint-disable-next-line */
const NON_LATIN_CODE_POINTS = /[^\u0000-\u00ff]/;

function multimatch(a, b) {
  let matches = a.localeCompare(b, undefined, {
    sensitivity: 'base',
  });

  if (matches === 0) {
    return true;
  }

  if (matches < 0) {
    matches = b.localeCompare(a, undefined, {
      sensitivity: 'base',
    });
  }

  if (matches === 0) {
    return true;
  }

  return false;
}

class SearchOp extends BaseOp {
  async onPOST() {
    throw new M2CException('SearchOp.onPOST not impl');
  }

  async onDELETE() {
    throw new M2CException('SearchOp.onDELETE not impl');
  }

  async onGET() {
    /* check to see if is searching a specific document */
    const id = (this.request.pathParameters || {}).uuid;
    if (id && !CommonUtils.validateUuid(id)) {
      throw new M2CException('invalid id');
    }

    const qs = {
      id,
      ...this.request.queryString,
    };

    Object.keys(qs)
      .forEach((x) => {
        if (qs[x] === undefined || qs[x] === 'undefined') {
          delete qs[x];
        }
      });

    /* new compound search */
    const response = await this.compoundSearch(qs);

    return super.onGET(response);
  }

  /* new compound search feature */
  async compoundSearch(qs) {
    const id = qs.id;

    const query = this.santizeQuerystring(qs.query);

    if (qs.token && Number.isNaN(qs.token)) {
      throw new M2CException('invalid token');
    }
    const from = Number(qs.token || 0);

    if (qs.pageSize && Number.isNaN(qs.pageSize)) {
      throw new M2CException('invalid pageSize');
    }
    const size = Number(qs.pageSize || DEFAULT_PAGESIZE);

    /* specified media types? */
    const types = MEDIA_TYPES
      .filter((x) =>
        qs[x] !== 'false');

    /* parse keywords and group query */
    const searchParams = this.buildCompoundQuery(
      id,
      types,
      query,
      from,
      size
    );
    console.log('searchParams', JSON.stringify(searchParams, null, 2));

    const indexer = new Indexer();

    const results = await indexer.search(searchParams)
      .then((res) => {
        const elapsed = res.body.took;
        const totalHits = res.body.hits.total.value;
        const hits = res.body.hits.hits || [];

        let nextToken = totalHits;
        if (hits.length >= size) {
          nextToken = from + size;
        }

        return {
          term: query,
          totalHits,
          nextToken,
          elapsed,
          hits,
        };
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });

    if (results.hits.length === 0) {
      return results;
    }

    const docs = this.parseSearchResults(results.hits);

    const mgetParams = {
      index: INDEX_CONTENT,
      body: {
        docs: docs
          .map((doc) => ({
            _id: doc.id,
            _source: {
              include: Object.keys(doc.fields),
            },
          })),
      },
    };

    const hits = await indexer.mget(mgetParams)
      .then((res) =>
        this.parseMultiGetResults(docs, res.body.docs))
      .catch((e) => {
        console.error(e);
        throw e;
      });

    results.hits = hits;

    return results;
  }

  santizeQuerystring(qs) {
    /* unwrap it from API Gateway */
    let query = decodeURIComponent(qs || '');

    try {
      /* test to see if it is base64 encoded */
      query = Buffer.from(query || '', 'base64').toString();

      /* unwrap again in case it is unicode string */
      query = decodeURIComponent(query);
    } catch (e) {
      /* do nothing */
    }

    if (query.length === 0
    || !CommonUtils.validateCharacterSet(query)) {
      throw new M2CException('invalid query');
    }

    /* split quoted search term */
    query = query
      .match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g)
      .filter((x) =>
        x);

    query = query
      .map((x) => {
        const upper = x.toUpperCase();
        if (COMPOUND_KEYWORDS.indexOf(upper) >= 0) {
          return upper;
        }
        return x;
      })
      .join(' ');

    console.log('query', query);

    return query;
  }

  buildCompoundQuery(
    id,
    types,
    query,
    from,
    size
  ) {
    const multiTerms = [
      {
        terms: {
          type: types,
        },
      },
      {
        query_string: {
          query,
          default_field: '*',
          analyze_wildcard: true,
        },
      },
    ];

    /* search in a specific document */
    if (id !== undefined) {
      multiTerms.push({
        terms: {
          _id: [
            id,
          ],
        },
      });
    }

    const doc = {
      index: INDEX_CONTENT,
      from,
      size,
      body: {
        _source: {
          includes: [
            'type',
          ],
        },
        query: {
          bool: {
            must: multiTerms,
          },
        },
        highlight: {
          fields: {
            '*': {},
          },
        },
      },
    };

    return doc;
  }

  parseSearchResults(hits) {
    const docs = [];

    while (hits.length) {
      const hit = hits.shift();
      const id = hit._id;
      const score = hit._score;
      const type = hit._source.type;

      const fields = {};
      const names = Object.keys(hit.highlight);
      while (names.length) {
        const name = names.shift();
        const field = name.split('.')[0];

        if (IGNORED_LIST.includes(field)) {
          continue;
        }

        if (fields[field] === undefined) {
          fields[field] = {
            highlights: [],
          };
        }

        fields[field].highlights = [
          ...new Set([
            ...fields[field].highlights,
            ...hit.highlight[name],
          ]),
        ];
      }

      if (Object.keys(fields).length > 0) {
        docs.push({
          id,
          score,
          type,
          fields,
        });
      }
    }

    console.log('docs', docs);

    return docs;
  }

  parseMultiGetResults(docs, mGetHits) {
    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i];

      /* find by doc id */
      const found = mGetHits.find((hit) =>
        hit._id === doc.id);

      if (!found) {
        continue;
      }

      const fieldsInDoc = Object.keys(doc.fields);
      fieldsInDoc.forEach((field) => {
        /* make sure field exists within the doc */
        if (!found._source[field]) {
          return;
        }

        doc.fields[field].highlights
          .forEach((highlight) => {
            const stripped = highlight
              .replaceAll(/<em>|<\/em>/gi, '');

            let hits;
            if (typeof found._source[field] === 'string') {
              /* string fields such as basename, mime, md5 */
              if (multimatch(found._source[field], stripped)) {
                hits = found._source[field];
              }
            } else if (Array.isArray(found._source[field])) {
              hits = found._source[field]
                .filter((x) =>
                  multimatch(x.name, stripped));
            } else {
              /* nested object field such as attributes, parse the 1st level value */
              const subkeys = Object.keys(found._source[field])
                .filter((x) =>
                  typeof found._source[field][x] === 'string'
                  && multimatch(found._source[field][x], stripped));

              if (subkeys.length > 0) {
                hits = subkeys.reduce((a0, c0) => ({
                  ...a0,
                  [c0]: found._source[field][c0],
                }), {});
              }
            }

            if (hits === undefined) {
              return;
            }

            if (doc.fields[field].hits === undefined) {
              doc.fields[field].hits = [];
            }

            doc.fields[field].hits =
              doc.fields[field].hits.concat(hits);
          });
      });
    }

    return docs;
  }
}

module.exports = SearchOp;
