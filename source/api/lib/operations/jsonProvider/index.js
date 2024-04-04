// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  CommonUtils,
  MimeTypeHelper,
  M2CException,
} = require('core-lib');
const CloudfirstProvider = require('./cloudfirstProvider');
const DefaultProvider = require('./defaultProvider');

class JsonProvider {
  static isJsonFile(key) {
    return MimeTypeHelper.parseMimeType(MimeTypeHelper.getMime(key)) === 'json';
  }

  static get Provider() {
    return {
      AWS: 'aws',
      CloudFirst: 'cloudfirst',
    };
  }

  static getProvider(data) {
    return CloudfirstProvider.isSupported(data)
      ? JsonProvider.Provider.CloudFirst
      : DefaultProvider.isSupported(data)
        ? JsonProvider.Provider.AWS
        : undefined;
  }

  static async createProvider(params) {
    let instance;

    if (!params.bucket || !params.key) {
      throw new M2CException('missing parameters');
    }

    if (!JsonProvider.isJsonFile(params.key)) {
      throw new M2CException('incorrect file type');
    }

    const response = await CommonUtils.download(params.bucket, params.key)
      .then((res) =>
        JSON.parse(res));

    switch (JsonProvider.getProvider(response)) {
      case JsonProvider.Provider.AWS:
        instance = new DefaultProvider(response);
        break;
      case JsonProvider.Provider.CloudFirst:
        instance = new CloudfirstProvider(response);
        break;
      default:
        break;
    }

    if (!instance) {
      throw new M2CException('fail to find provider');
    }
    return instance;
  }
}

module.exports = JsonProvider;
