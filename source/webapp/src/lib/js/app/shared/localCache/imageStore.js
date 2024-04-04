// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetS3Utils,
} from '../s3utils.js';
import StoreDefinitions from './storeDefs.js';
import BaseStore from './baseStore.js';

/* singleton implementation */
let _singleton;

class ImageStore extends BaseStore {
  constructor() {
    super(StoreDefinitions.Stores.Images);
    _singleton = this;
  }

  async getImageURL(id, bucket, key) {
    let blob = await this.getItem(id);
    if (!blob) {
      const s3utils = GetS3Utils();
      const response = await s3utils.getObject(bucket, key);

      blob = await response.Body.transformToByteArray()
        .then((res) =>
          new Blob([res.buffer], {
            type: response.ContentType,
          }));
      await this.putItem(id, blob);
    }

    return URL.createObjectURL(blob);
  }

  async getBlob(url) {
    let blob = await this.getItem(url);
    if (!blob) {
      blob = await fetch(url)
        .then((res) => {
          if (!res.ok) {
            return undefined;
          }
          /* also check content type to ensure it is image */
          const type = (res.headers.get('Content-Type') || '')
            .split('/')
            .shift();
          if (!type || !['image', 'video'].includes(type.toLowerCase())) {
            return undefined;
          }
          return res.blob();
        });
      if (!blob) {
        return undefined;
      }
      await this.putItem(url, blob);
    }
    return URL.createObjectURL(blob);
  }
}

const GetImageStore = () => {
  if (_singleton === undefined) {
    const notused_ = new ImageStore();
  }

  return _singleton;
};

export {
  ImageStore,
  GetImageStore,
};
