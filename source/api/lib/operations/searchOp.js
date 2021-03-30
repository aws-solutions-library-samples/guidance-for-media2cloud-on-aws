/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  BaseIndex,
} = require('core-lib');
const BaseOp = require('./baseOp');

class SearchOp extends BaseOp {
  async onPOST() {
    throw new Error('SearchOp.onPOST not impl');
  }

  async onDELETE() {
    throw new Error('SearchOp.onDELETE not impl');
  }

  async onGET() {
    const qs = {
      ...this.request.queryString,
    };
    Object.keys(qs).forEach((x) => {
      if (qs[x] === undefined || qs[x] === 'undefined') {
        delete qs[x];
      }
    });
    qs.query = qs.query && decodeURIComponent(qs.query);
    if (!qs.query || !/^[^<>()%&'"]*$/.test(qs.query)) {
      throw new Error('invalid query');
    }
    if (qs.token && !Number.parseInt(qs.token, 10)) {
      throw new Error('invalid token');
    }
    if (qs.pageSize && !Number.parseInt(qs.pageSize, 10)) {
      throw new Error('invalid pageSize');
    }
    const categories = [
      'audio',
      'video',
      'image',
      'document',
    ].map(x => ((qs[x] === undefined || qs[x] === 'true')
      ? `type:${x}`
      : undefined)).filter(x => x);
    const params = {
      query: (categories.length)
        ? `(${categories.join(' OR ')}) AND (${qs.query})`
        : qs.query,
      exact: (qs.exact === 'true'),
      pageSize: qs.pageSize,
      token: qs.token,
    };
    return super.onGET(await (new BaseIndex()).searchDocument(params));
  }
}

module.exports = SearchOp;
