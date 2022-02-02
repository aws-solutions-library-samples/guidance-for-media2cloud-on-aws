// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  NotImplError,
} = require('core-lib');

class BaseProvider {
  constructor(data) {
    this.$data = data;
    this.$collectionUuid = undefined;
    this.$files = [];
  }

  static isSupported() {
    throw new NotImplError('method not impl');
  }

  parse() {
    throw new NotImplError('method not impl');
  }

  get attributes() {
    throw new NotImplError('property not impl');
  }

  set attributes(val) {
    throw new NotImplError('property not impl');
  }

  get data() {
    return this.$data;
  }

  get collectionUuid() {
    return this.$collectionUuid;
  }

  set collectionUuid(val) {
    this.$collectionUuid = val;
  }

  get files() {
    return this.$files;
  }

  set files(val) {
    this.$files = val.slice(0);
  }

  getFiles() {
    return this.files;
  }
}

module.exports = BaseProvider;
