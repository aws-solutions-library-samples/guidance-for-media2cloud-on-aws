// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  Indexer,
} = require('core-lib');
const BaseOp = require('./baseOp');

class StatsOp extends BaseOp {
  async onPOST() {
    throw new Error('StatsOp.onGET not impl');
  }

  async onDELETE() {
    throw new Error('StatsOp.onDELETE not impl');
  }

  async onGET() {
    const qs = this.request.queryString || {};
    const indices = (qs.aggregate || '')
      .split(',')
      .filter((x) => x);
    const size = Number(qs.size || 100);
    if (Number.isNaN(size)) {
      throw new Error('invalid size');
    }
    const response = (indices.length > 0)
      ? await this.aggregateSearch(indices, size)
      : await this.getOverallStats(size);
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
      index: 'ingest',
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
      }));
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
      index: 'ingest',
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
      .then((res) => res.body.hits.hits.map((x) => ({
        ...x._source,
        uuid: x._id,
      })));
  }

  async aggregateSearch(indices, size) {
    const availableIndices = Indexer.getIndices();
    for (let index of indices) {
      if (availableIndices.indexOf(index) < 0) {
        throw new Error('invalid aggregate value');
      }
    }
    const name = indices.join(',');
    const indexer = new Indexer();
    return indexer.aggregate(name, size)
      .then((res) => ({
        aggregations: res[name][name].buckets.map((x) => ({
          name: x.key,
          count: x.doc_count,
        })),
      }));
  }
}

module.exports = StatsOp;
