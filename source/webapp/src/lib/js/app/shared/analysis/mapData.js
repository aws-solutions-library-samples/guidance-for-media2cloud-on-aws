// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  GetS3Utils,
} from '../s3utils.js';

export default class MapData {
  constructor(mapData) {
    this.$version = 0;
    this.$labels = [];
    this.$files = [];
    this.initialize(mapData);
  }

  get version() {
    return this.$version;
  }

  set version(val) {
    this.$version = val;
  }

  get labels() {
    return this.$labels;
  }

  set labels(val) {
    this.$labels = val;
  }

  get files() {
    return this.$files;
  }

  set files(val) {
    this.$files = Array.isArray(val)
      ? val
      : [val];
  }

  get basenames() {
    return this.$labels
      .map((x) =>
        x.toLowerCase()
          .replace(/\s/g, '_')
          .replace(/\//g, '-'));
  }

  initialize(mapData) {
    if (mapData) {
      if (mapData.version > 0) {
        this.$version = mapData.version;
        this.$labels = mapData.data;
        this.$files = [
          mapData.file,
        ];
      } else {
        this.$labels = Object.keys(mapData);
        this.$files = [
          ...new Set(Object.values(mapData)
            .flat(1)),
        ];
      }
    }
  }

  static async load(bucket, keyOrPrefix) {
    if (keyOrPrefix[keyOrPrefix.length - 1] === '/') {
      return this.loadFromPrefix(bucket, keyOrPrefix);
    }
    return this.loadFromKey(bucket, keyOrPrefix);
  }

  static async loadFromKey(bucket, key) {
    const s3utils = GetS3Utils();
    let mapData = await s3utils.getObject(bucket, key)
      .catch(() =>
        undefined);

    if (mapData) {
      mapData = await mapData.Body.transformToString()
        .then((res) =>
          JSON.parse(res));
    }

    return new MapData(mapData);
  }

  static async loadFromPrefix(bucket, prefix) {
    const s3utils = GetS3Utils();
    const labels = await s3utils.listObjects(
      bucket,
      prefix
    ).then((res) =>
      res.map((x) =>
        x.Key.substring(
          x.Key.lastIndexOf('/') + 1,
          x.Key.lastIndexOf('.')
        )))
      .catch(() =>
        ([]));
    const mapData = new MapData();
    mapData.labels = labels;

    return mapData;
  }
}
