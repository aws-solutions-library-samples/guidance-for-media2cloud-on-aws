/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  StatsDB,
  BaseIndex,
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
    const size = (this.request.queryString || {}).size || 100;
    if (size && !Number.parseInt(size, 10)) {
      throw new Error('invalid size');
    }
    const [
      largest,
      longest,
      recents,
      overall,
    ] = await Promise.all([
      this.searchLargestFile(),
      this.searchLongestDuration(),
      this.searchMostRecentItems(size),
      StatsDB.scanAll(),
    ]);
    return super.onGET({
      largest,
      longest,
      recents,
      overall,
    });
  }

  async searchLargestFile() {
    return this.searchIndex({
      body: {
        from: 0,
        size: 1,
        _source: {
          includes: [
            'type',
            'basename',
            'fileSize',
          ],
        },
        sort: [{
          fileSize: {
            order: 'desc',
          },
        }],
        query: {
          match_all: {},
        },
      },
    });
  }

  async searchLongestDuration() {
    return this.searchIndex({
      body: {
        from: 0,
        size: 1,
        _source: {
          includes: [
            'type',
            'basename',
            'duration',
          ],
        },
        sort: [{
          duration: {
            order: 'desc',
          },
        }],
        query: {
          match_all: {},
        },
      },
    });
  }

  async searchMostRecentItems(size = 100) {
    return this.searchIndex({
      body: {
        from: 0,
        size,
        _source: {
          includes: [
            'type',
            'basename',
            'duration',
            'fileSize',
            'lastModified',
            'timestamp',
          ],
        },
        sort: [{
          timestamp: {
            order: 'desc',
          },
        }],
        query: {
          match_all: {},
        },
      },
    });
  }

  async searchIndex(params) {
    const indexer = new BaseIndex();
    return indexer.query(params)
      .then(data => data.body.hits.hits.map(x => ({
        uuid: x._id,
        ...x._source,
      })))
      .catch(e =>
        console.log(`searchIndex: ${e.message}\n${JSON.stringify(params, null, 2)}`));
  }
}

module.exports = StatsOp;
