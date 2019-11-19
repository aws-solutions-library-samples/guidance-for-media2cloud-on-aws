/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
class DefaultJsonParser {
  constructor(data, reader) {
    this.$jsonData = data;
    this.$reader = reader;
    this.$collectionUuid = undefined;
    this.$files = [];
    this.parse();
  }

  get jsonData() {
    return this.$jsonData;
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

  get attributes() {
    return {
      collectionUuid: this.collectionUuid,
    };
  }

  async parse() {
    this.collectionUuid = this.jsonData.collectionUuid
      || AppUtils.uuid4();

    this.files = this.jsonData.files.map(x => ({
      uuid: x.uuid || AppUtils.uuid4(),
      key: x.location,
      mime: window.AWSomeNamespace.Mime.getType(x.location),
      md5: (x.checksums || []).filter(x0 => x0.type.toLowerCase() === 'md5').shift().value,
    }));
    return this.files;
  }
}
