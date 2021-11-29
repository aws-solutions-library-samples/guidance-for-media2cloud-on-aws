// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import SolutionManifest from '/solution-manifest.js';
import ApiHelper from '../apiHelper.js';
import AppUtils from '../appUtils.js';
import S3Utils from '../s3utils.js';
import FaceStore from '../localCache/faceStore.js';

export default class FaceManager {
  static getSingleton() {
    if ((window.AWSomeNamespace || {}).FaceManagerInstance === undefined) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        FaceManagerInstance: new FaceManager(),
      };
    }
    return window.AWSomeNamespace.FaceManagerInstance;
  }

  constructor() {
    this.$faceStore = FaceStore.getSingleton();
    this.$collections = [];
    this.$facesByCollection = {};
  }

  get faceStore() {
    return this.$faceStore;
  }

  get collections() {
    return this.$collections;
  }

  set collections(val) {
    this.$collections = val;
  }

  get facesByCollection() {
    return this.$facesByCollection;
  }

  set facesByCollection(val) {
    this.$facesByCollection = val;
  }

  async getCollections() {
    if (!this.collections.length) {
      this.collections = await ApiHelper.getFaceCollections();
    }
    return this.collections;
  }

  async refreshCollections() {
    this.collections = await ApiHelper.getFaceCollections();
    this.facesByCollection = {};
    return this.collections;
  }

  async createCollection(collectionId) {
    const collection = await ApiHelper.createFaceCollection(collectionId);
    if (!collection || !collection.name) {
      return undefined;
    }
    this.collections.push(collection);
    return collection;
  }

  async deleteCollection(collectionId) {
    await ApiHelper.deleteFaceCollection(collectionId);
    if (this.collections.length) {
      const idx = this.collections.findIndex((x) =>
        x.name === collectionId);
      if (idx >= 0) {
        this.collections.splice(idx, 1);
      }
    }
    delete this.facesByCollection[collectionId];
  }

  async getFacesInCollection(collectionId, token) {
    if (!token
      && this.facesByCollection[collectionId]
      && this.facesByCollection[collectionId].faces.length) {
      return this.facesByCollection[collectionId];
    }
    const response = await ApiHelper.getFacesInCollection(collectionId, {
      token,
    });
    if (this.facesByCollection[collectionId] === undefined) {
      this.facesByCollection[collectionId] = {
        faces: [],
      };
    }
    this.facesByCollection[collectionId].faces.splice(
      this.facesByCollection[collectionId].faces.length,
      0,
      ...response.faces
    );
    this.facesByCollection[collectionId].token = response.token;
    return response;
  }

  async getFaceImage(key) {
    let blob;
    if (key) {
      blob = await this.faceStore.getItem(key);
      if (!blob) {
        const bucket = SolutionManifest.Proxy.Bucket;
        const url = S3Utils.signUrl(bucket, key);
        blob = await AppUtils.downscale(url);
        blob = await (await fetch(blob)).blob();
        await this.faceStore.putItem(key, blob);
      }
    }
    return (blob)
      ? URL.createObjectURL(blob)
      : undefined;
  }

  async deleteFace(collectionId, faceId) {
    await ApiHelper.deleteFaceFromCollection(collectionId, faceId);
    if (this.facesByCollection[collectionId]) {
      const idx = this.facesByCollection[collectionId].faces.findIndex((x) =>
        x.faceId === faceId);
      if (idx >= 0) {
        this.facesByCollection[collectionId].faces.splice(idx, 1);
      }
    }
  }

  async indexFace(collectionId, name, data) {
    const externalImageId = name.replace(/\s/g, '_');
    const response = await ApiHelper.indexFaceToCollection(collectionId, {
      externalImageId,
      blob: data,
    });
    if (response.key) {
      let blob = await AppUtils.downscale(data);
      blob = await (await fetch(blob)).blob();
      await this.faceStore.putItem(response.key, blob);
    }
    return response;
  }
}
