// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Indexer,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const INDEX_CONTENT = Indexer.getContentIndex();

class StatsOp extends BaseOp {
  async onPOST() {
    throw new M2CException('StatsOp.onGET not impl');
  }

  async onDELETE() {
    throw new M2CException('StatsOp.onDELETE not impl');
  }

  async onGET() {
    const qs = this.request.queryString || {};
    let aggregate = '';
    if (qs.aggregate) {
      aggregate = decodeURIComponent(qs.aggregate);
    }

    const fields = aggregate
      .split(',')
      .filter((x) => x);

    const size = Number(qs.size || 100);
    if (Number.isNaN(size)) {
      throw new M2CException('invalid size');
    }

    let response;

    if (fields.length > 0) {
      response = await this.aggregateSearch(fields, size);
    } else {
      response = await this.getOverallStats(size);
    }

    return super.onGET(response);
  }

  async getOverallStats(size) {
    return Promise.all([
      this.getIngestStats(),
      this.getMostRecentIngestedAssets(size),
    ]).then((res) => ({
      stats: res[0],
      recents: res[1],
    }));
  }

  async getIngestStats() {
    const indexer = new Indexer();

    const query = {
      index: INDEX_CONTENT,
      body: {
        size: 0,
        aggs: {
          groupByType: {
            terms: {
              field: 'type',
            },
            aggs: {
              maxSize: {
                max: {
                  field: 'fileSize',
                },
              },
              minSize: {
                min: {
                  field: 'fileSize',
                },
              },
              avgSize: {
                avg: {
                  field: 'fileSize',
                },
              },
              totalSize: {
                sum: {
                  field: 'fileSize',
                },
              },
              /* duration */
              maxDuration: {
                max: {
                  field: 'duration',
                },
              },
              minDuration: {
                min: {
                  field: 'duration',
                },
              },
              avgDuration: {
                avg: {
                  field: 'duration',
                },
              },
              totalDuration: {
                sum: {
                  field: 'duration',
                },
              },
            },
          },
          groupByOverallStatus: {
            terms: {
              field: 'overallStatus',
            },
            aggs: {
              count: {
                value_count: {
                  field: 'overallStatus',
                },
              },
            },
          },
        },
      },
    };

    return indexer.search(query)
      .then((res) => ({
        types: res.body.aggregations.groupByType.buckets.map((x) => ({
          type: x.key,
          count: x.doc_count,
          fileSize: {
            max: Math.floor(x.maxSize.value),
            min: Math.floor(x.minSize.value),
            avg: Math.floor(x.avgSize.value),
            total: Math.floor(x.totalSize.value),
          },
          duration: {
            max: Math.floor(x.maxDuration.value),
            min: Math.floor(x.minDuration.value),
            avg: Math.floor(x.avgDuration.value),
            total: Math.floor(x.totalDuration.value),
          },
        })),
        overallStatuses: res.body.aggregations.groupByOverallStatus.buckets.map((x) => ({
          overallStatus: x.key,
          count: x.count.value,
        })),
      }))
      .catch((e) => {
        console.log('=== getIngestStats');
        console.error(e);
        throw e;
      });
  }

  async getMostRecentIngestedAssets(size = 100) {
    const indexer = new Indexer();
    const includes = [
      'type',
      'basename',
      'duration',
      'fileSize',
      'lastModified',
      'timestamp',
    ];
    const query = {
      index: INDEX_CONTENT,
      body: {
        from: 0,
        size,
        _source: {
          includes,
        },
        sort: [
          {
            timestamp: 'desc',
          },
        ],
      },
    };

    return indexer.search(query)
      .then((res) =>
        res.body.hits.hits
          .map((x) => ({
            ...x._source,
            uuid: x._id,
          })))
      .catch((e) => {
        console.log('=== getMostRecentIngestedAssets');
        console.error(e);
        throw e;
      });
  }

  async aggregateSearch(fields, size) {
    const availableFields = Indexer.getAnalysisFields();

    for (let i = 0; i < fields.length; i++) {
      if (!availableFields.includes(fields[i])) {
        throw new M2CException('invalid aggregate value');
      }
    }

    const indexer = new Indexer();

    return indexer.aggregate(fields, size)
      .then((res) => ({
        aggregations: Object.keys(res)
          .reduce((a0, c0) => ({
            ...a0,
            [c0]: res[c0].buckets
              .map((x) => ({
                name: x.key,
                count: x.doc_count,
              })),
          }), {}),
      }))
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }
}

module.exports = StatsOp;
