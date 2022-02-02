// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import S3Utils from '../s3utils.js';
import AppUtils from '../appUtils.js';
import ApiHelper from '../apiHelper.js';
import mxReadable from '../../mixins/mxReadable.js';
import ImageStore from '../localCache/imageStore.js';
import DatasetStore from '../localCache/datasetStore.js';

const DEFAULT_IMAGE = './images/image.png';

export default class BaseMedia extends mxReadable(class {}) {
  constructor(data) {
    super();
    this.$data = {
      ...data,
    };
    this.$analysisResults = undefined;
    this.$store = ImageStore.getSingleton();
    this.$datasetStore = DatasetStore.getSingleton();
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

  get imageinfo() {
    return this.$data.imageinfo;
  }

  get docinfo() {
    return this.$data.docinfo;
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
    const data = await ApiHelper.getRecord(this.uuid);
    const bucket = data.destination.bucket;
    /* reload mediainfo */
    if (Array.isArray(data.mediainfo) && data.mediainfo.length > 0) {
      const key = data.mediainfo.find(x => /\.json$/.test(x));
      if (bucket && key) {
        data.mediainfo = await S3Utils.getObject(bucket, key)
          .then((res) =>
            JSON.parse(res.Body.toString()).mediaInfo)
          .catch((e) =>
            console.error(`[ERR]: fail to get mediainfo. ${encodeURIComponent(e.message)}`));
      }
    } else if (data.imageinfo) {
      /* reload imageinfo */
      data.imageinfo = await S3Utils.getObject(bucket, data.imageinfo)
        .then((res) =>
          JSON.parse(res.Body.toString()))
        .catch((e) =>
          console.error(`[ERR]: fail to get imageinfo. ${encodeURIComponent(e.message)}`));
    }
    this.data = data;
    /* reload analysis results */
    if (this.status === SolutionManifest.Statuses.AnalysisCompleted) {
      await this.getAnalysisResults(true);
    }
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
    return this.store.getImageURL(uuid, bucket, key).catch(() => undefined)
      || S3Utils.signUrl(bucket, key);
  }

  /* type other than image */
  async getUrl(bucket, key) {
    return S3Utils.signUrl(bucket, key);
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

  async getProxyVideo() {
    const proxy = this.proxies.find(x => x.type === 'video');
    return (proxy)
      ? S3Utils.signUrl(this.proxyBucket, proxy.key)
      : undefined;
  }

  async getProxyAudio() {
    const proxy = this.proxies.find(x => x.type === 'audio');
    return (proxy)
      ? S3Utils.signUrl(this.proxyBucket, proxy.key)
      : undefined;
  }

  getBasename(key) {
    return key.substring(key.lastIndexOf('/') + 1, key.length);
  }

  async getProxyImage() {
    const proxy = this.proxies.filter(x => x.type === 'image')
      .sort((a, b) => b.fileSize - a.fileSize)[0];
    return (proxy)
      ? this.getImageUrl(`${this.uuid}-${this.getBasename(proxy.key)}`, this.proxyBucket, proxy.key)
      : this.defaultImage;
  }

  async getNamedImageUrl(bucket, key) {
    const name = this.getBasename(key);
    const url = await this.getImageUrl(`${this.uuid}-${name}`, bucket, key);
    return {
      name,
      url,
    };
  }

  async getProxyNamedImageAll() {
    const proxy = this.proxies.filter(x => x.type === 'image');
    return (proxy.length)
      ? Promise.all(proxy.map(x => this.getNamedImageUrl(this.proxyBucket, x.key)))
      : undefined;
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
}
