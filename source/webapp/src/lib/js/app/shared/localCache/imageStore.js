// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import S3Utils from '../s3utils.js';
import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

export default class ImageStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Images);
  }

  static getSingleton() {
    if (!(window.AWSomeNamespace || {}).ImageStoreSingleton) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        ImageStoreSingleton: new ImageStore(),
      };
    }
    return window.AWSomeNamespace.ImageStoreSingleton;
  }

  async getImageURL(id, bucket, key) {
    let blob = await this.getItem(id);
    if (!blob) {
      const response = await S3Utils.getObject(bucket, key);
      blob = new Blob([response.Body.buffer], {
        type: response.ContentType,
      });
      await this.putItem(id, blob);
    }
    return URL.createObjectURL(blob);
  }
}
