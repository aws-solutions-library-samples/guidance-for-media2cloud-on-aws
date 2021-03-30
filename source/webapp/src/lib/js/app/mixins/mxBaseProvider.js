/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * @class NotImplError
 * @description Error code 1009
 */
class NotImplError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1009;
    this.message = `${this.errorCode} - ${this.message || 'not impl'}`;
    Error.captureStackTrace(this, NotImplError);
  }
}

/**
 * @mixins mxBaseProvider
 * @description abstract class for JSON Definition Provider
 */
const mxBaseProvider = Base => class extends Base {
  constructor(data, reader) {
    super(data, reader);
    this.$data = data;
    this.$reader = reader;
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

  get reader() {
    return this.$reader;
  }

  get key() {
    return this.reader.name;
  }

  get filesize() {
    return this.reader.size;
  }

  get mime() {
    return this.reader.type
    || window.AWSomeNamespace.Mime.getType(this.reader.name);
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
};
