/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const {
  mxCommonUtils,
  mxNeat,
} = require('./mxCommonUtils');

class X0 extends mxCommonUtils(class {}) {}

/* eslint-disable class-methods-use-this */
class BaseMetadata extends mxNeat(class {}) {
  constructor(kind, params = {}) {
    super();
    const {
      Bucket,
      VttTracks,
      MetaTracks,
    } = params;

    this.$kind = kind;
    this.$bucket = Bucket;
    this.$vttTracks = Object.assign({}, VttTracks);
    this.$metaTracks = Object.assign({}, MetaTracks);
  }

  get [Symbol.toStringTag]() {
    return 'BaseMetadata';
  }

  get kind() {
    return this.$kind;
  }

  get bucket() {
    return this.$bucket;
  }

  set bucket(val) {
    this.$bucket = val;
  }

  get vttTracks() {
    return this.$vttTracks;
  }

  get vttPrefix() {
    return this.$vttTracks.Prefix;
  }

  get vttKeys() {
    return this.$vttTracks.Keys || [];
  }

  set vttKeys(val) {
    this.$vttTracks.Keys = val.slice(0);
  }

  get metaTracks() {
    return this.$metaTracks;
  }

  get metaPrefix() {
    return this.$metaTracks.Prefix;
  }

  get metaKeys() {
    return this.$metaTracks.Keys || [];
  }

  set metaKeys(val) {
    this.$metaTracks.Keys = val.slice(0);
  }

  update(bucket, vtt, meta) {
    if (bucket) {
      this.bucket = bucket;
    }

    if (vtt) {
      this.vttTracks.Prefix = vtt.Prefix;
      this.vttTracks.Keys = vtt.Keys;
    }

    if (meta) {
      this.metaTracks.Prefix = meta.Prefix;
      this.metaTracks.Keys = meta.Keys;
    }
  }

  toJSON() {
    const json = { Kind: this.kind };

    if (this.vttPrefix) {
      json.VttTracks = { Prefix: this.vttPrefix };
    }

    if (this.metaPrefix) {
      json.MetaTracks = { Prefix: this.metaPrefix };
    }

    return BaseMetadata.neat(json);
  }


  canLoadVttTracks() {
    /* only load if keys array is empty and bucket/prefix is present */
    return !!(!this.vttKeys.length && this.bucket && this.vttPrefix);
  }

  canLoadMetaTracks() {
    /* only load if keys array is empty and bucket/prefix is present */
    return !!(!this.metaKeys.length && this.bucket && this.metaPrefix);
  }

  async loadVttTracks() {
    if (this.canLoadVttTracks()) {
      const slash = (this.vttPrefix.substr(-1) !== '/') ? '/' : '';

      const contents = await X0.listObjects(this.bucket, `${this.vttPrefix}${slash}`);

      this.vttKeys = contents.map(x => x.Key);
    }

    return this.vttKeys.length;
  }

  async loadMetaTracks() {
    if (this.canLoadMetaTracks()) {
      const slash = (this.metaPrefix.substr(-1) !== '/') ? '/' : '';

      const contents = await X0.listObjects(this.bucket, `${this.metaPrefix}${slash}`);

      this.metaKeys = contents.map(x => x.Key);
    }

    return this.metaKeys.length;
  }
}

class PersonsMetadata extends BaseMetadata {
  constructor(params) {
    super('persons', params);
  }

  get [Symbol.toStringTag]() {
    return 'PersonsMetadata';
  }
}

class CelebsMetadata extends BaseMetadata {
  constructor(params) {
    super('celebs', params);
  }

  get [Symbol.toStringTag]() {
    return 'CelebsMetadata';
  }
}

class FacesMetadata extends BaseMetadata {
  constructor(params) {
    super('faces', params);
  }

  get [Symbol.toStringTag]() {
    return 'FacesMetadata';
  }
}

class FaceMatchesMetadata extends BaseMetadata {
  constructor(params) {
    super('face_matches', params);
  }

  get [Symbol.toStringTag]() {
    return 'FaceMatchesMetadata';
  }
}

class LabelsMetadata extends BaseMetadata {
  constructor(params) {
    super('labels', params);
  }

  get [Symbol.toStringTag]() {
    return 'LabelsMetadata';
  }
}

class SubtitleMetadata extends BaseMetadata {
  constructor(params) {
    super('transcript', params);
  }

  get [Symbol.toStringTag]() {
    return 'SubtitleMetadata';
  }
}

class EntitiesMetadata extends BaseMetadata {
  constructor(params) {
    super('entities', params);
  }

  get [Symbol.toStringTag]() {
    return 'EntitiesMetadata';
  }
}

class KeyPhrasesMetadata extends BaseMetadata {
  constructor(params) {
    super('phrases', params);
  }

  get [Symbol.toStringTag]() {
    return 'KeyPhrasesMetadata';
  }
}

class MachineMetadataAttributes {
  constructor(params = {}) {
    const {
      Bucket,
    } = params;
    this.$bucket = Bucket;

    const kinds = Object.assign({}, params);
    delete kinds.Bucket;

    this.$instances = {};

    Object.keys(kinds).forEach((x) => {
      this.$instances[x] =
        MachineMetadataAttributes.createMetadataInstanceBy(x, Object.assign({
          Bucket,
        }, kinds[x]));
    });
  }

  get [Symbol.toStringTag]() {
    return 'MachineMetadataAttributes';
  }

  static createMetadataInstanceBy(kind, params) {
    if (kind === 'persons') {
      return new PersonsMetadata(params);
    }

    if (kind === 'celebs') {
      return new CelebsMetadata(params);
    }

    if (kind === 'faces') {
      return new FacesMetadata(params);
    }

    if (kind === 'face_matches') {
      return new FaceMatchesMetadata(params);
    }

    if (kind === 'labels') {
      return new LabelsMetadata(params);
    }

    if (kind === 'transcript') {
      return new SubtitleMetadata(params);
    }

    if (kind === 'entities') {
      return new EntitiesMetadata(params);
    }

    if (kind === 'phrases') {
      return new KeyPhrasesMetadata(params);
    }

    return undefined;
  }

  get instances() {
    return this.$instances;
  }

  get bucket() {
    return this.$bucket;
  }

  set bucket(val) {
    this.$bucket = val;
  }

  get persons() {
    return this.$instances.persons;
  }

  get celebs() {
    return this.$instances.celebs;
  }

  get faces() {
    return this.$instances.faces;
  }

  get matches() {
    return this.$instances.face_matches;
  }

  get labels() {
    return this.$instances.labels;
  }

  get transcript() {
    return this.$instances.transcript;
  }

  get entities() {
    return this.$instances.entities;
  }

  get keyphrases() {
    return this.$instances.phrases;
  }

  reset(kind, metadata = {}) {
    const {
      Bucket,
    } = metadata;

    this.bucket = this.bucket || Bucket;
    this.instances[kind] = MachineMetadataAttributes.createMetadataInstanceBy(kind, metadata);
  }

  canLoadVttTracks() {
    return Object.keys(this.instances).reduce((flag, cur) =>
      flag || this.instances[cur].canLoadVttTracks(), false);
  }

  canLoadMetaTracks() {
    return Object.keys(this.instances).reduce((flag, cur) =>
      flag || this.instances[cur].canLoadMetaTracks(), false);
  }

  async loadVttTracks() {
    return new Promise(async (resolve, reject) => {
      try {
        const promises = Object.keys(this.instances).map(kind =>
          this.instances[kind].loadVttTracks());

        const result = await Promise.all(promises);

        resolve(result.reduce((sum, x) => sum + x, 0));
      } catch (e) {
        process.env.ENV_QUIET || console.error(e);
        reject(e);
      }
    });
  }

  async loadMetaTracks() {
    return new Promise(async (resolve, reject) => {
      try {
        const promises = Object.keys(this.instances).map(kind =>
          this.instances[kind].loadMetaTracks());

        const result = await Promise.all(promises);

        resolve(result.reduce((sum, x) => sum + x, 0));
      } catch (e) {
        process.env.ENV_QUIET || console.error(e);
        reject(e);
      }
    });
  }

  toJSON() {
    const result = {
      Bucket: this.bucket,
    };

    Object.keys(this.instances).forEach((kind) => {
      result[kind] = this.instances[kind].toJSON();
    });

    return BaseMetadata.neat(result);
  }
}

module.exports = {
  BaseMetadata,
  PersonsMetadata,
  CelebsMetadata,
  FacesMetadata,
  FaceMatchesMetadata,
  LabelsMetadata,
  SubtitleMetadata,
  EntitiesMetadata,
  KeyPhrasesMetadata,
  MachineMetadataAttributes,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    BaseMetadata,
    PersonsMetadata,
    CelebsMetadata,
    FacesMetadata,
    FaceMatchesMetadata,
    LabelsMetadata,
    SubtitleMetadata,
    EntitiesMetadata,
    KeyPhrasesMetadata,
    MachineMetadataAttributes,
  });
