// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import {
  GetS3Utils,
} from '../s3utils.js';
import AppUtils from '../appUtils.js';
import ApiHelper from '../apiHelper.js';
import mxReadable from '../../mixins/mxReadable.js';
import {
  GetImageStore,
  GetDatasetStore,
} from '../localCache/index.js';

const DEFAULT_IMAGE = './images/image.png';

export default class BaseMedia extends mxReadable(class {}) {
  constructor(data) {
    super();
    this.$data = {
      ...data,
    };
    this.$analysisResults = undefined;
    this.$store = GetImageStore();
    this.$datasetStore = GetDatasetStore();
  }

  get data() {
    return this.$data;
  }

  set data(val) {
    this.$data = val;
  }

  get analysisResults() {
    return this.$analysisResults;
  }

  set analysisResults(val) {
    this.$analysisResults = val;
  }

  get store() {
    return this.$store;
  }

  get datasetStore() {
    return this.$datasetStore;
  }

  get uuid() {
    return this.$data.uuid;
  }

  get type() {
    return this.$data.type;
  }

  get lastModified() {
    return this.$data.lastModified;
  }

  get lastModifiedISOFormat() {
    return BaseMedia.isoDateTime(this.lastModified);
  }

  get timestamp() {
    return this.$data.timestamp;
  }

  get timestampISOFormat() {
    return BaseMedia.isoDateTime(this.timestamp);
  }

  get basename() {
    return this.$data.basename;
  }

  get bucket() {
    return this.$data.bucket;
  }

  get key() {
    return this.$data.key;
  }

  get schemaVersion() {
    return this.$data.schemaVersion;
  }

  get storageClass() {
    return this.$data.storageClass;
  }

  get fileSize() {
    return this.$data.fileSize;
  }

  get readableFileSize() {
    return BaseMedia.readableFileSize(this.fileSize);
  }

  get mime() {
    return this.$data.mime;
  }

  get md5() {
    return this.$data.md5;
  }

  get proxies() {
    return this.$data.proxies;
  }

  get mediainfo() {
    return this.$data.mediainfo;
  }

  set mediainfo(val) {
    this.$data.mediainfo = val;
  }

  get imageinfo() {
    return this.$data.imageinfo;
  }

  set imageinfo(val) {
    this.$data.imageinfo = val;
  }

  get docinfo() {
    return this.$data.docinfo;
  }

  set docinfo(val) {
    this.$data.docinfo = val;
  }

  get executionArn() {
    return this.$data.executionArn;
  }

  get status() {
    return this.$data.status;
  }

  get overallStatus() {
    return this.$data.overallStatus;
  }

  get errorMessage() {
    return this.$data.errorMessage;
  }

  get aiOptions() {
    return this.$data.aiOptions;
  }

  get attributes() {
    return this.$data.attributes;
  }

  get duration() {
    return this.$data.duration;
  }

  get readableDuration() {
    return BaseMedia.readableDuration(this.duration);
  }

  get proxyBucket() {
    return (this.$data.destination || {}).bucket;
  }

  get proxyPrefix() {
    return (this.$data.destination || {}).prefix;
  }

  get defaultImage() {
    return DEFAULT_IMAGE;
  }

  getVideoDimension() {
    const track = this.mediainfo.media.track.find((x) =>
      x.$.type.toLowerCase() === 'video') || {};
    return {
      width: track.width || 0,
      height: track.height || 0,
    };
  }

  async refresh() {
    /* remove local cache */
    const promiseRemoveCache = this.datasetStore
      .deleteItemsBy(this.uuid);

    this.data = await ApiHelper.getRecord(this.uuid);

    /* load technical metadata */
    await Promise.all([
      this.loadMediaInfo(),
      this.loadImageInfo(),
    ]);

    /* reload analysis results */
    if (this.status === SolutionManifest.Statuses.AnalysisCompleted) {
      await this.getAnalysisResults(true);
    }

    await promiseRemoveCache;
    return this;
  }

  async setError() {
    const data = await ApiHelper.getRecord(this.uuid);
    this.data = data;
  }

  async getThumbnail() {
    const images = (this.proxies || []).filter(x => x.type === 'image');
    if (!images.length) {
      return this.defaultImage;
    }
    const idx = AppUtils.randomNumber(images.length - 1, 0);
    return this.getImageUrl(this.uuid, this.proxyBucket, images[idx].key);
  }

  async getImageUrl(uuid, bucket, key) {
    let url = await this.store.getImageURL(
      uuid,
      bucket,
      key
    ).catch(() =>
      undefined);

    if (!url) {
      const s3utils = GetS3Utils();
      url = await s3utils.signUrl(
        bucket,
        key
      );
    }

    return url;
  }

  /* type other than image */
  async getUrl(bucket, key) {
    const s3utils = GetS3Utils();

    return s3utils.signUrl(
      bucket,
      key
    );
  }

  getMediainfo() {
    return this.mediainfo;
  }

  getImageinfo() {
    return this.imageinfo;
  }

  getDocinfo() {
    return this.docinfo;
  }

  getProxyBucket() {
    return this.proxyBucket;
  }

  getProxyPrefix() {
    return this.proxyPrefix;
  }

  async getProxyVideo() {
    const proxy = this.proxies
      .find((x) =>
        x.type === 'video');

    if (proxy !== undefined) {
      const s3utils = GetS3Utils();
      return s3utils.signUrl(
        this.proxyBucket,
        proxy.key
      );
    }

    return undefined;
  }

  async getProxyAudio() {
    const proxy = this.proxies
      .find((x) =>
        x.type === 'audio');

    if (proxy !== undefined) {
      const s3utils = GetS3Utils();
      return s3utils.signUrl(
        this.proxyBucket,
        proxy.key
      );
    }

    return undefined;
  }

  getBasename(key) {
    return key.substring(key.lastIndexOf('/') + 1, key.length);
  }

  async getProxyImage() {
    const proxy = this.proxies
      .filter((x) =>
        x.type === 'image')
      .sort((a, b) =>
        b.fileSize - a.fileSize)[0];

    if (proxy !== undefined) {
      const imageId = [
        this.uuid,
        this.getBasename(proxy.key),
      ].join('-');

      return this.getImageUrl(
        imageId,
        this.proxyBucket,
        proxy.key
      );
    }

    return this.defaultImage;
  }

  async getNamedImageUrl(bucket, key) {
    const name = this.getBasename(key);
    const imageId = [
      this.uuid,
      name,
    ].join('-');

    const url = await this.getImageUrl(
      imageId,
      bucket,
      key
    );

    return {
      name,
      url,
    };
  }

  async getProxyNamedImageAll() {
    const proxy = this.proxies
      .filter((x) =>
        x.type === 'image');

    if (proxy && proxy.length > 0) {
      return Promise.all(
        proxy.map((image) =>
          this.getNamedImageUrl(
            this.proxyBucket,
            image.key
          ))
      );
    }

    return undefined;
  }

  async getAnalysisResults(reload = false) {
    if ((!this.analysisResults || reload)) {
      this.analysisResults = await ApiHelper.getAnalysisResults(this.uuid);
    }
    return this.analysisResults;
  }

  async getDataset(bucket, key) {
    return this.datasetStore.getDataset(bucket, key);
  }

  getRekognitionResults() {
    return (this.analysisResults || []).map(x =>
      x.rekognition).filter(x => x)[0];
  }

  getRekognitionImageResults() {
    return (this.analysisResults || []).map(x =>
      x['rekog-image']).filter(x => x)[0];
  }

  getTranscribeResults() {
    return (this.analysisResults || []).map(x =>
      x.transcribe).filter(x => x)[0];
  }

  getComprehendResults() {
    return (this.analysisResults || []).map(x =>
      x.comprehend).filter(x => x)[0];
  }

  getTextractResults() {
    return (this.analysisResults || []).map(x =>
      x.textract).filter(x => x)[0];
  }

  /* BLIP model */
  getImageAutoCaptioning() {
    return ((this.analysisResults || [])[0] || {}).caption;
  }

  async loadMediaInfo() {
    if (Array.isArray(this.mediainfo)
    && this.mediainfo.length > 0) {
      const bucket = this.proxyBucket;
      const key = this.mediainfo
        .find((x) =>
          /\.json$/.test(x));
      if (bucket && key) {
        const s3utils = GetS3Utils();
        let mediainfo = await s3utils.getObject(
          bucket,
          key
        ).catch((e) => {
          console.error(
            'ERR:',
            'fail to get mediainfo',
            key,
            e.message
          );

          return undefined;
        });

        if (mediainfo) {
          mediainfo = await mediainfo.Body.transformToString()
            .then((res) =>
              JSON.parse(res)
                .mediaInfo);
          this.mediainfo = mediainfo;
        }
      }
    }

    return this.mediainfo;
  }

  async loadImageInfo() {
    if (typeof this.imageinfo === 'string'
    && this.proxyBucket) {
      const s3utils = GetS3Utils();
      let imageinfo = await s3utils.getObject(
        this.proxyBucket,
        this.imageinfo
      ).catch((e) => {
        console.error(
          'ERR:',
          'fail to get imageinfo',
          this.imageinfo,
          e.message
        );

        return undefined;
      });

      if (imageinfo) {
        imageinfo = await imageinfo.Body.transformToString()
          .then((res) =>
            JSON.parse(res));

        this.imageinfo = imageinfo;
      }
    }

    return this.imageinfo;
  }
}
