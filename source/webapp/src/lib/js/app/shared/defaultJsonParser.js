/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
class DefaultJsonParser extends mxBaseProvider(class {}) {
  static isSupported(data) {
    return (data || {}).collectionUuid;
  }

  get attributes() {
    return {
      collectionUuid: this.collectionUuid,
    };
  }

  async parse() {
    this.collectionUuid = this.data.collectionUuid
      || AppUtils.uuid4();

    this.files = this.data.files.map(x => ({
      uuid: x.uuid || AppUtils.uuid4(),
      key: x.location,
      mime: window.AWSomeNamespace.Mime.getType(x.location),
      md5: (x.checksums || []).filter(x0 => x0.type.toLowerCase() === 'md5').shift().value,
    }));
  }
}
