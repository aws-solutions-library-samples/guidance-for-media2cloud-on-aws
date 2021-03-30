/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

class CustomJsonParser extends mxBaseProvider(class {}) {
  constructor(data, reader) {
    super(data, reader);
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
      || AppUtils.uuid4();

    const bucket = ((this.data.targetInfo || []).find(x =>
      x.type.toLowerCase() === 's3') || {}).bucketName;
    const prefix = this.data.migrationObject.relativePath || '';

    this.files = this.data.migrationObject.files.map(x => JSON.parse(JSON.stringify({
      uuid: x.uuid || AppUtils.uuid4(),
      bucket,
      key: CustomJsonParser.joinPath(prefix, x.name),
      mime: window.AWSomeNamespace.Mime.getType(x.name)
        || CustomJsonParser.Constant.DefaultMimeType,
      md5: (x.checksums || []).filter(x0 => x0.type.toLowerCase() === 'md5').shift().value,
    })));

    this.attributes = {
      collectionUuid: this.collectionUuid,
      ...this.data,
    };
  }

  static joinPath(prefix, key) {
    return !prefix ? key : `${prefix.replace(/^\/|\/$/g, '')}/${key}`;
  }
}
