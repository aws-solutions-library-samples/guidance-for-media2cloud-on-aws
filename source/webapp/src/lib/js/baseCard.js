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
/* eslint-disable class-methods-use-this */
/* eslint-disable no-plusplus */
/* eslint-disable no-alert */
/* eslint-disable no-await-in-loop */

/**
 * @class BaseCard
 * @description base class to extract the basic properties of Video, Audio, Image, Document.
 */
class BaseCard extends mxReadable(class {}) {
  constructor(data = {}, parent) {
    super();
    const missing = BaseCard.MandatoryProps.filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`BaseCard.constructor missing ${missing.join(', ')}`);
    }

    if (!(parent instanceof CardCollection)) {
      throw new Error('parent must be instance of CardCollection');
    }

    this.$parent = parent;
    this.$aimlResults = undefined;
    this.$data = Object.assign({}, data);
  }

  static get MandatoryProps() {
    return [
      'uuid',
      'type',
      /*
      'key',
      'basename',
      'mime',
      'fileSize',
      'storageClass',
      'lastModified',
      */
    ];
  }

  static get States() {
    return window.AWSomeNamespace.States;
  }

  static get Statuses() {
    return window.AWSomeNamespace.Statuses;
  }

  get parent() {
    return this.$parent;
  }

  set parent(val) {
    this.$parent = val;
  }

  get data() {
    return this.$data;
  }

  set data(val) {
    this.$data = Object.assign({}, val);
  }

  get type() {
    return this.data.type;
  }

  get uuid() {
    return this.data.uuid;
  }

  get md5() {
    return this.data.md5;
  }

  get key() {
    return this.data.key;
  }

  get basename() {
    return this.data.basename;
  }

  get mime() {
    return this.data.mime;
  }

  get fileSize() {
    return this.data.fileSize;
  }

  get storageClass() {
    return this.data.storageClass;
  }

  get lastModified() {
    return this.data.lastModified;
  }

  get lastModifiedISOFormat() {
    return this.lastModified && new Date(this.lastModified).toISOString();
  }

  get attributes() {
    return this.data.attributes;
  }

  hasAnalyzed() {
    return this.aimlResults || (this.data.analysis || []).length > 0;
  }

  get aimlResults() {
    return this.$aimlResults;
  }

  set aimlResults(val) {
    this.$aimlResults = (val || []).length ? val.slice(0) : undefined;
  }

  get vttTracks() {
    return this.$vttTracks;
  }

  set vttTracks(val) {
    this.$vttTracks = (val && Object.assign({}, val)) || undefined;
  }

  async loadAimlResults(reload = false) {
    if (!this.aimlResults || reload) {
      this.aimlResults = await ApiHelper.getAnalysisResults(this.uuid);
    }
  }

  static async download(bucket, key) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });
    return JSON.parse((await s3.getObject({
      Bucket: bucket,
      Key: key,
    }).promise()).Body.toString());
  }

  static signedUrl(bucket, key, expires = 60 * 60 * 2) {
    return (!bucket || !key)
      ? undefined
      : (new AWS.S3({
        apiVersion: '2006-03-01',
        signatureVersion: 'v4',
      })).getSignedUrl('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: expires,
      });
  }

  static async fileExists(bucket, key) {
    try {
      if (!bucket || !key) {
        return false;
      }
      await (new AWS.S3({
        apiVersion: '2006-03-01',
      })).headObject({
        Bucket: bucket,
        Key: key,
      }).promise();
      return true;
    } catch (e) {
      return false;
    }
  }

  static parseKeyBasename(key) {
    const basename = key.split('/').filter(x0 => x0).pop();
    return basename.slice(0, basename.lastIndexOf('.'));
  }
}
