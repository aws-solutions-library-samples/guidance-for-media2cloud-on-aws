// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import ApiHelper from '../apiHelper.js';
import AppUtils from '../appUtils.js';
import {
  GetS3Utils,
} from '../s3utils.js';
import {
  GetFaceStore,
} from '../localCache/index.js';

const {
  Proxy: {
    Bucket: PROXY_BUCKET,
  },
  AnalysisTypes: {
    AutoFaceIndexer,
  },
  FaceIndexerDefs: {
    Actions: {
      Tagging: TAGGING_FACE,
      Deleting: DELETING_FACE,
    },
  },
} = SolutionManifest;
const {
  Buffer,
} = window.Polyfill;

const ON_FACE_COLLECTION_ADDED = 'facemanager:collection:added';
const ON_FACE_COLLECTION_REMOVED = 'facemanager:collection:removed';
const ON_FACE_ADDED = 'facemanager:face:added';
const ON_FACE_REMOVED = 'facemanager:face:removed';

const REGEX_EXTERNAL_IMAGE_ID = /^v[0-9]{1,}:[a-f0-9]{32}:[0-9]+$/;
const REGEX_HEXSTR = /^[a-f0-9]{6,}$/;

/* singleton implementation */
let _singleton;

/* receive update event on face manager event */
const _receivers = {};

const _onFaceManagerEvent = (event, data) => {
  setTimeout(async () => {
    const names = Object.keys(_receivers);
    try {
      await Promise.all(
        names.map((name) =>
          _receivers[name](event, data)
            .catch((e) => {
              console.error(
                'ERR:',
                `_onFaceManagerEvent.${event}.${name}:`,
                e.message
              );
              return undefined;
            }))
      );

      console.log(
        'INFO:',
        `_onFaceManagerEvent.${event}:`,
        `${names.length} receivers:`,
        names.join(', ')
      );
    } catch (e) {
      console.error(
        'ERR:',
        `_onFaceManagerEvent.${event}:`,
        e
      );
    }
  }, 10);
};

class FaceManager {
  constructor() {
    this.$faceStore = GetFaceStore();
    this.$collections = [];
    this.$facesByCollection = {};

    _singleton = this;
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
    try {
      if (this.collections.length === 0) {
        this.collections = await ApiHelper.getFaceCollections();
      }

      return this.collections;
    } catch (e) {
      console.error(e);
      return this.collections;
    }
  }

  async refreshCollections() {
    this.facesByCollection = {};

    this.collections.length = 0;
    await this.getCollections();

    return this.collections;
  }

  async createCollection(collectionId) {
    try {
      const collection = await ApiHelper.createFaceCollection(collectionId);

      if (!(collection || {}).name) {
        return undefined;
      }

      const idx = this.collections
        .findIndex((x) =>
          x.name === collection.name);

      if (idx < 0) {
        this.collections.push(collection);

        _onFaceManagerEvent(
          ON_FACE_COLLECTION_ADDED,
          collection
        );
      }

      return collection;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async deleteCollection(collectionId) {
    try {
      await ApiHelper.deleteFaceCollection(collectionId);

      if (this.collections.length) {
        const idx = this.collections
          .findIndex((x) =>
            x.name === collectionId);

        if (idx >= 0) {
          const deleted = this.collections.splice(idx, 1);

          _onFaceManagerEvent(
            ON_FACE_COLLECTION_REMOVED,
            deleted[0]
          );
        }
      }

      delete this.facesByCollection[collectionId];
    } catch (e) {
      console.error(e);
    }
  }

  async getFacesInCollection(
    collectionId,
    token
  ) {
    try {
      if (!token
        && this.facesByCollection[collectionId]
        && this.facesByCollection[collectionId].faces.length) {
        return this.facesByCollection[collectionId];
      }

      const response = await ApiHelper.getFacesInCollection(collectionId, { token });

      // sort the results based on timestamp than celeb
      response.faces.sort((a, b) => {
        const { celeb: celebA } = a;
        const { celeb: celebB } = b;

        if (!celebA && celebB) {
          return 1;
        }
        if (!celebB && celebA) {
          return -1;
        }

        if (celebA === celebB) {
          const { timestamp: timeA } = a;
          const { timestamp: timeB } = b;
          return timeB - timeA;
        }

        return celebA.localeCompare(celebB);
      });

      if (this.facesByCollection[collectionId] === undefined) {
        this.facesByCollection[collectionId] = {
          faces: [],
        };
      }

      this.facesByCollection[collectionId].faces
        = this.facesByCollection[collectionId].faces.concat(response.faces);

      this.facesByCollection[collectionId].token
        = response.token;

      return this.facesByCollection[collectionId];
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async getFaceImage(key, fullSize = false) {
    try {
      if (!key) {
        return undefined;
      }

      let blob = await this.faceStore.getItem(key);

      if (!blob) {
        const s3utils = GetS3Utils();
        const url = await s3utils.signUrl(
          PROXY_BUCKET,
          key
        );

        blob = await this.storeFace(
          key,
          url,
          fullSize
        );
      }

      if (blob) {
        return URL.createObjectURL(blob);
      }

      return undefined;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async getFaceImageById(collectionId, faceId) {
    const collection = this.facesByCollection[collectionId];

    let key;
    if (collection && collection.faces) {
      const face = collection.faces
        .find((x) =>
          x.faceId === faceId);
      if (face !== undefined && face.key !== undefined) {
        key = await this.getFaceImage(face.key);
      }
    }

    if (key === undefined) {
      // try face indexer path
      let name = faceId.replaceAll('-', '');
      name = `${name}.jpg`;

      key = [
        AutoFaceIndexer,
        collectionId,
        name,
      ].join('/');
      key = await this.getFaceImage(key);

      // fall back to old collection path
      if (key === undefined) {
        name = `${faceId}.png`;
        key = [
          'face-collection',
          collectionId,
          name,
        ].join('/');
        key = await this.getFaceImage(key);
      }
    }

    return key;
  }

  async deleteFace(
    collectionId,
    faceId
  ) {
    try {
      await ApiHelper.deleteFaceFromCollection(
        collectionId,
        faceId
      ).then((res) => {
        /* make sure to update the collection face count */
        const found = this.collections
          .find((collection) =>
            collection.name === collectionId);
        found.faces -= 1;

        return res;
      });

      if (this.facesByCollection[collectionId]) {
        const idx = this.facesByCollection[collectionId].faces
          .findIndex((face) =>
            face.faceId === faceId);

        if (idx >= 0) {
          const deleted = this.facesByCollection[collectionId].faces
            .splice(idx, 1);

          _onFaceManagerEvent(ON_FACE_REMOVED, {
            collectionId,
            ...deleted[0],
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async indexFace(
    uuid,
    timestamp,
    collectionId,
    celeb,
    blob
  ) {
    try {
      const payload = {
        uuid,
        collectionId,
        timestamp,
        celeb,
        blob,
      };

      const response = await ApiHelper.indexFaceV2(
        payload
      ).then((res) => {
        /* make sure to update the collection face count */
        const found = this.collections
          .find((collection) =>
            collection.name === collectionId);
        found.faces += 1;
        return res;
      });

      let newFace;
      if (response.externalImageId && response.faceId) {
        const blobUrl = await this.storeFace(
          response.key,
          blob
        ).then((res) =>
          URL.createObjectURL(res));

        newFace = {
          externalImageId: response.externalImageId,
          faceId: response.faceId,
          blob: blobUrl,
        };

        if (this.facesByCollection[collectionId] === undefined) {
          await this.getFacesInCollection(
            collectionId
          );

          _onFaceManagerEvent(ON_FACE_ADDED, {
            collectionId,
            ...newFace,
          });

          return newFace;
        }

        const idx = this.facesByCollection[collectionId]
          .faces
          .findIndex((face) =>
            face.faceId === newFace.faceId);

        if (idx < 0) {
          this.facesByCollection[collectionId]
            .faces
            .push(newFace);

          _onFaceManagerEvent(ON_FACE_ADDED, {
            collectionId,
            ...newFace,
          });
        }
      }

      return newFace;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async storeFace(
    name,
    blobOrUrl,
    fullSize = false
  ) {
    let blob;
    if (fullSize) {
      blob = await AppUtils.loadImage(blobOrUrl);
    } else {
      blob = await AppUtils.downscale(blobOrUrl);
    }

    blob = await fetch(blob);
    blob = await blob.blob();

    await this.faceStore.putItem(name, blob);

    return blob;
  }

  async batchGetFaces(faceIds) {
    // slice the request to X faces per request
    const batchSize = 40;

    let _faceIds = faceIds;
    if (!Array.isArray(faceIds)) {
      _faceIds = [faceIds];
    }

    let promises = [];
    while (_faceIds.length > 0) {
      const spliced = _faceIds.splice(0, batchSize);
      promises.push(ApiHelper.batchGetFaces(spliced));
    }

    promises = await Promise.all(promises);
    promises = promises.flat(1);

    return promises;
  }

  async updateFaceTaggings(faceIds, optionalUuid) {
    return ApiHelper.updateFaceTaggings(
      faceIds,
      optionalUuid
    ).then((res) => {
      const {
        updated = [],
        deleted = [],
      } = res;
      updated.forEach((face) => {
        if (this.facesByCollection[face.collectionId]) {
          const faces = this.facesByCollection[face.collectionId].faces;

          const idx = faces.findIndex((x) =>
            x.faceId === face.faceId);
          if (idx >= 0) {
            faces[idx] = face;
          } else {
            faces.push(face);
          }
        }
      });

      deleted.forEach((face) => {
        if (this.facesByCollection[face.collectionId]) {
          const faces = this.facesByCollection[face.collectionId].faces;

          const idx = faces.findIndex((x) =>
            x.faceId === face.faceId);
          if (idx >= 0) {
            faces.splice(idx, 1);
          }
        }
      });

      return {
        updated,
        deleted,
      };
    });
  }

  async importFaceCollection(collectionId) {
    const params = {
      collectionId,
    };
    return ApiHelper.importFaceCollection(params)
      .then((res) => {
        this.facesByCollection[collectionId].faces = res.processed;
        this.facesByCollection[collectionId].token = res.token;
        return res;
      });
  }

  async startFaceIndexing(params, progressFn = undefined) {
    let response = await ApiHelper.indexFaceV2(params);
    const { executionArn } = response;

    if (typeof progressFn !== 'function') {
      return response;
    }

    const t0 = Date.now();
    response = undefined;
    do {
      // Take longer than 8 minutes
      if ((Date.now() - t0) > 8 * 60 * 1000) {
        response = { status: 'ATTENTION_REQUIRED', executionArn };
        progressFn(response);
        return response;
      }

      try {
        await _pause(2000);
        response = await ApiHelper.getWorkflowStatus(executionArn);
        progressFn(response);
      } catch (e) {
        console.log(e);
      }
    } while ((response || {}).status === 'RUNNING');

    return response;
  }

  // static functions
  static isExternalImageIdCompatible(id) {
    return REGEX_EXTERNAL_IMAGE_ID.test(id);
  }

  static resolveExternalImageId(id = '', defaultTo = false) {
    if (FaceManager.isExternalImageIdCompatible(id)) {
      if (typeof defaultTo === 'string') {
        return defaultTo;
      }
      if (defaultTo === true) {
        return id;
      }
      return undefined;
    }

    let name = id;
    // some verison of m2c may store hex string format for
    // unicoded names
    if (REGEX_HEXSTR.test(name)) {
      name = Buffer.from(name, 'hex')
        .toString('utf8');
    }

    // some version of m2c may store ascii name
    // in first_last format - Jane_Doe
    name = name.replace(/_/g, ' ')
      .replace(/\b\w/g, (c) =>
        c.toUpperCase());

    return name;
  }
}

async function _pause(delay) {
  return await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
}

const GetFaceManager = () => {
  if (_singleton === undefined) {
    const notused_ = new FaceManager();
  }

  return _singleton;
};

const RegisterFaceManagerEvent = (name, target) => {
  if (!name || typeof target !== 'function') {
    return false;
  }

  _receivers[name] = target;
  return true;
};

const UnregisterFaceManagerEvent = (name) => {
  delete _receivers[name];
};

const GetFaceManagerS3Prefix = () =>
  AutoFaceIndexer;

export {
  FaceManager,
  GetFaceManager,
  RegisterFaceManagerEvent,
  UnregisterFaceManagerEvent,
  ON_FACE_COLLECTION_ADDED,
  ON_FACE_COLLECTION_REMOVED,
  ON_FACE_ADDED,
  ON_FACE_REMOVED,
  TAGGING_FACE,
  DELETING_FACE,
  GetFaceManagerS3Prefix,
};
