/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const {
  BaseIndex,
} = require('m2c-core-lib');

const {
  BaseOp,
} = require('./baseOp');

class SearchOp extends BaseOp {
  async onPOST() {
    throw new Error('SearchOp.onPOST not impl');
  }

  async onDELETE() {
    throw new Error('SearchOp.onDELETE not impl');
  }

  async onGET() {
    const params = Object.assign({}, this.request.queryString);

    Object.keys(params).forEach((x) => {
      if (!params[x] || params[x] === 'undefined') {
        delete params[x];
      }
    });

    if (!params.query) {
      throw new Error('invalid query');
    }

    params.query = decodeURIComponent(params.query);

    if (!/^[^<>()%&'"]*$/.test(params.query)) {
      throw new Error('invalid query');
    }

    if (params.token && !Number.parseInt(params.token, 10)) {
      throw new Error('invalid token');
    }

    if (params.pageSize && !Number.parseInt(params.pageSize, 10)) {
      throw new Error('invalid pageSize');
    }

    return super.onGET(await (new BaseIndex()).searchDocument(params));
  }
}

module.exports = {
  SearchOp,
};
