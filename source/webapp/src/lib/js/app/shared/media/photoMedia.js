// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import S3Utils from '../s3utils.js';
import BaseMedia from './baseMedia.js';

const SUFFIX = '_thumbnail';

export default class PhotoMedia extends BaseMedia {
  get width() {
    return (this.imageinfo || {}).ImageWidth;
  }

  get height() {
    return (this.imageinfo || {}).ImageHeight;
  }

  async getThumbnail() {
    const images = (this.proxies || []).filter(x =>
      x.type === 'image').sort((a, b) =>
      a.fileSize - b.fileSize);
    if (!images.length) {
      return this.defaultImage;
    }
    let blob;
    /* best effort to load thumbnail version of the image. */
    let lastIdx = images[0].key.lastIndexOf(`${SUFFIX}.jpg`);
    if (lastIdx < 0) {
      lastIdx = images[0].key.lastIndexOf('.jpg');
      let key = images[0].key.substring(0, lastIdx);
      key = `${key}${SUFFIX}.jpg`;
      blob = await this.store.getImageURL(`${this.uuid}${SUFFIX}`, this.proxyBucket, key)
        .catch(() => undefined);
    }
    if (!blob) {
      blob = await this.store.getImageURL(this.uuid, this.proxyBucket, images[0].key)
        .catch(() => undefined);
    }
    return blob || S3Utils.signUrl(this.proxyBucket, images[0].key);
  }
}
