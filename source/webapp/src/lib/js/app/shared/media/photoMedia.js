import S3Utils from '../s3utils.js';
import BaseMedia from './baseMedia.js';

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
    return await this.store.getImageURL(this.uuid, this.proxyBucket, images[0].key).catch(() => undefined)
      || S3Utils.signUrl(this.proxyBucket, images[0].key);
  }
}
