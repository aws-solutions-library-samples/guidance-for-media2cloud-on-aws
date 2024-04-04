// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  CommonUtils,
  MimeTypeHelper,
} = require('core-lib');
const BaseProvider = require('./baseProvider');

class CloudfirstProvider extends BaseProvider {
  constructor(data) {
    super(data);
    this.$attributes = undefined;
  }

  static get Constant() {
    return {
      DefaultMimeType: 'application/gxf',
    };
  }

  static isSupported(data) {
    return (data || {}).migrationObject;
  }

  get attributes() {
    return this.$attributes;
  }

  set attributes(val) {
    this.$attributes = val;
  }

  parse() {
    this.collectionUuid = (this.data.legacyArchiveObject || {}).legacyArchiveObjectUuid
      || CommonUtils.uuid4();

    const bucket = ((this.data.targetInfo || []).find(x =>
      x.type.toLowerCase() === 's3') || {}).bucketName;
    const prefix = this.data.migrationObject.relativePath || '';

    this.files = this.data.migrationObject.files.map(x => CommonUtils.cleansing({
      uuid: x.uuid || CommonUtils.uuid4(),
      bucket,
      // eslint-disable-next-line
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
      key: CommonUtils.sanitizedKey(PATH.join(prefix, x.name)),
      mime: MimeTypeHelper.getMime(x.name) || CloudfirstProvider.Constant.DefaultMimeType,
      md5: (x.checksums || []).filter(x0 => x0.type.toLowerCase() === 'md5').shift().value,
    }));

    this.attributes = CommonUtils.cleansing({
      collectionUuid: this.collectionUuid,
      ...this.data,
    });
  }
}

module.exports = CloudfirstProvider;
