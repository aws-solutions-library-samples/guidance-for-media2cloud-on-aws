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
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const {
  DB,
} = require('./db');

const {
  MachineMetadataAttributes,
} = require('./machineMetadata');

const {
  mxArchiveAttributes,
} = require('./mxArchiveAttributes');

const {
  mxCommonUtils,
  mxNeat,
} = require('./mxCommonUtils');

/**
 * @class BaseAttributes
 * @description asset basic attributes includes
 * { Bucket, Key, LastModified, ContentType, ContentLength }
 */
class BaseAttributes extends mxNeat(class {}) {
  constructor(params = {}) {
    super();

    const {
      Bucket,
      Key,
      MD5,
      LastModified,
      ContentLength,
      ContentType,
    } = params;

    this.$bucket = Bucket;
    this.$key = Key;
    this.$md5 = MD5;
    this.$lastModified = (LastModified) ? new Date(LastModified) : undefined;
    this.$contentLength = (ContentLength) ? Number.parseInt(ContentLength, 10) : undefined;
    this.$contentType = ContentType;
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'BaseAttributes';
  }
  /* eslint-enable class-methods-use-this */

  get bucket() {
    return this.$bucket;
  }

  get key() {
    return this.$key;
  }

  get md5() {
    return this.$md5;
  }

  get lastModified() {
    return this.$lastModified;
  }

  get contentLength() {
    return this.$contentLength;
  }

  get contentType() {
    return this.$contentType;
  }

  get lastModifiedISOFormat() {
    return (this.lastModified) ? this.lastModified.toISOString() : undefined;
  }

  get readableContentLength() {
    return BaseAttributes.readableFileSize(this.contentLength || 0);
  }

  toJSON() {
    return BaseAttributes.neat({
      Bucket: this.bucket,
      Key: this.key,
      MD5: this.md5,
      LastModified: (this.lastModified) ? this.lastModified.getTime() : undefined,
      ContentLength: this.contentLength,
      ContentType: this.contentType,
    });
  }

  /**
   * @function readableFileSize
   * @description convert file size to readable format
   * @param {[string|number]} size
   */
  static readableFileSize(size) {
    const fileSize = Number.parseInt(size || 0, 10);

    if (!fileSize) {
      return '0 B';
    }

    const i = Math.floor(Math.log(fileSize) / Math.log(1024));

    /* eslint-disable no-restricted-properties */
    return `${(fileSize / Math.pow(1024, i)).toFixed(2) * 1} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`;
    /* eslint-enabled no-restricted-properties */
  }

  /**
   * @function readableDuration
   * @description convert duration to readable format
   * @param {number} durationInMs
   */
  static readableDuration(durationInMs) {
    function padding(num, base = 100) {
      if (num > base) {
        return num.toString();
      }

      const array = num.toString().split('');
      let shift = (Number.parseInt(Math.log10(base), 10)) - array.length;

      while (shift > 0) {
        array.unshift('0');
        shift -= 1;
      }

      return array.join('');
    }

    const offsetMillis = Number.parseInt(durationInMs, 10);
    const HH = Math.floor(offsetMillis / 3600000);
    const MM = Math.floor((offsetMillis % 3600000) / 60000);
    const SS = Math.floor((offsetMillis % 60000) / 1000);
    const mmm = Math.ceil(offsetMillis % 1000);

    return `${padding(HH)}:${padding(MM)}:${padding(SS)}.${padding(mmm, 1000)}`;
  }

  /**
   * @function readableBitrate
   * @description convert bitrate to readable format
   * @param {[string|number]} bitrate
   */
  static readableBitrate(bitrate) {
    const br = Number.parseInt(bitrate || 0, 10);

    if (!br) {
      return '0 Kbps';
    }

    const i = Math.floor(Math.log(br) / Math.log(1024));

    /* eslint-disable no-restricted-properties */
    return `${(br / Math.pow(1024, i)).toFixed(2) * 1} ${['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'][i]}`;
    /* eslint-enabled no-restricted-properties */
  }
}

/**
 * @class GlacierAttributes
 * @description proxy attributes contain additional MediaInfo properthy
 */
class GlacierAttributes extends mxArchiveAttributes(BaseAttributes) {
  constructor(params = {}) {
    super(params);
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'GlacierAttributes';
  }
  /* eslint-enable class-methods-use-this */

  toJSON() {
    return BaseAttributes.neat(super.toJSON());
  }
}

/**
 * @class ProxyAttributes
 * @description proxy attributes contain additional Audio and Image properties
 */
class ProxyAttributes extends BaseAttributes {
  constructor(params = {}) {
    super(params);
    const {
      AudioKey,
      ImageKey,
      LowresKey,
    } = params;

    this.$audioKey = AudioKey;
    this.$imageKey = ImageKey;
    this.$lowresKey = LowresKey;
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'ProxyAttributes';
  }
  /* eslint-enable class-methods-use-this */

  get audioKey() {
    return this.$audioKey;
  }

  set audioKey(val) {
    this.$audioKey = val;
  }

  get imageKey() {
    return this.$imageKey;
  }

  set imageKey(val) {
    this.$imageKey = val;
  }

  get lowresKey() {
    return this.$lowresKey;
  }

  set lowresKey(val) {
    this.$lowresKey = val;
  }

  toJSON() {
    const json = Object.assign({}, super.toJSON(), {
      AudioKey: this.audioKey,
      ImageKey: this.imageKey,
      LowresKey: this.lowresKey,
    });

    return BaseAttributes.neat(json);
  }
}


/**
 * @class VideoAsset
 * @description wrapper of DB entry of the Asset table
 * shared by both frontend / backend javascript
 */
class VideoAsset extends mxCommonUtils(class {}) {
  constructor(params = {}) {
    super();

    const {
      UUID,
      Glacier,
      Proxy,
      MachineMetadata,
    } = params;

    this.$uuid = UUID;
    this.$glacier = new GlacierAttributes(Glacier || {});
    this.$proxy = new ProxyAttributes(Proxy || {});
    this.$machineMetadata = new MachineMetadataAttributes(MachineMetadata || {});
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'VideoAsset';
  }
  /* eslint-enable class-methods-use-this */

  get uuid() {
    return this.$uuid;
  }

  get glacier() {
    return this.$glacier;
  }

  set glacier(val) {
    if (val instanceof GlacierAttributes) {
      this.$glacier = val;
    } else {
      const merged = Object.assign({}, this.$glacier.toJSON(), val);

      this.$glacier = new GlacierAttributes(merged);
    }
  }

  get proxy() {
    return this.$proxy;
  }

  set proxy(val) {
    if (val instanceof ProxyAttributes) {
      this.$proxy = val;
    } else {
      /* merge proxy data */
      const merged = Object.assign({}, this.$proxy.toJSON(), val);

      this.$proxy = new ProxyAttributes(merged);
    }
  }

  get machineMetadata() {
    return this.$machineMetadata;
  }

  set machineMetadata(val) {
    if (val instanceof MachineMetadataAttributes) {
      this.$machineMetadata = val;
    } else {
      const merged = Object.assign({}, this.$machineMetadata.toJSON(), val);

      this.$machineMetadata = new MachineMetadataAttributes(merged);
    }
  }

  toJSON() {
    const json = {
      UUID: this.uuid,
      Glacier: this.glacier.toJSON(),
      Proxy: this.proxy.toJSON(),
      MachineMetadata: this.machineMetadata.toJSON(),
    };

    return BaseAttributes.neat(json);
  }

  /**
   * @function signedUrl
   */
  static signedUrl(Bucket, Key) {
    if (!Bucket || !Key) {
      return undefined;
    }

    const signed = VideoAsset.getSignedUrl({ Bucket, Key });

    return signed;
  }

  /**
   * @function fileExists
   * @param {string} Bucket
   * @param {string} Key
   */
  static async fileExists(Bucket, Key) {
    try {
      if (!Bucket || !Key) {
        return false;
      }

      await VideoAsset.headObject(Bucket, Key);

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * @function signedGlacierUrl
   */
  signedGlacierUrl() {
    const signed = VideoAsset.signedUrl(this.glacier.bucket, this.glacier.key);
    return signed;
  }

  /**
   * @function signedProxyUrl
   */
  signedProxyUrl() {
    const signed = VideoAsset.signedUrl(this.proxy.bucket, this.proxy.key);
    return signed;
  }

  /**
   * @function signedImageUrl
   */
  signedImageUrl() {
    const signed = VideoAsset.signedUrl(this.proxy.bucket, this.proxy.imageKey);
    return signed;
  }

  /**
   * @function signedAudioUrl
   */
  signedAudioUrl() {
    const signed = VideoAsset.signedUrl(this.proxy.bucket, this.proxy.audioKey);
    return signed;
  }

  /**
   * @function signedLowresUrl
   */
  signedLowresUrl() {
    const signed = VideoAsset.signedUrl(this.proxy.bucket, this.proxy.lowresKey);
    return signed;
  }

  /**
   * @function createFromDIVA
   * @param {string} Bucket
   * @param {string} Key
   */
  static async createFromDIVA(Bucket, Key) {
    try {
      const response = await GlacierAttributes.loadFromDIVA(Bucket, Key);

      const {
        UUID,
      } = response;

      return new VideoAsset({
        UUID,
        Glacier: response,
      });
    } catch (e) {
      throw e;
    }
  }

  /**
   * @function createDIVADocument
   * @description create a DIVA document based on the video file
   * @param {object} params - Bucket, Key, Metadata of the video file being uploaded
   */
  static async createDIVADocument(params) {
    const {
      Bucket,
      Key,
      Metadata,
    } = params;

    const {
      md5: x,
      uuid,
    } = Metadata || {};

    /* convert MD5 back to hex string if is Base64 */
    const md5 = VideoAsset.toMD5String(x);

    return GlacierAttributes.createDIVADocument(Bucket, Key, md5, uuid);
  }

  /**
   * @function createFromGlacier
   * @description get object info, generate UUID if needed
   * @param {object} params - Bucket, Key
   */
  static async createFromGlacier(params) {
    const {
      Bucket,
      Key,
    } = params;

    const response = await VideoAsset.headObject(Bucket, Key);
    process.env.ENV_QUIET || console.log(`response = ${JSON.stringify(response, null, 2)}`);

    const {
      LastModified,
      ContentLength,
      ContentType,
      ETag,
      Metadata = {},
    } = response;

    const {
      uuid,
      md5,
    } = Metadata;

    const UUID = uuid || VideoAsset.uuid4();
    const MD5 = VideoAsset.toMD5String(md5 || ETag.match(/([0-9a-fA-F]{32})/)[1]);

    return new VideoAsset({
      UUID,
      Glacier: {
        Bucket, Key, LastModified, ContentLength, ContentType, MD5,
      },
    });
  }

  /**
   * @function updateDB
   * @description update VideoAsset attributes to DB
   * @param {string} Table - table to write to
   * @param {string} PartitionKey - partition key
   */
  async updateDB(Table, PartitionKey) {
    const db = new DB({
      Table, PartitionKey,
    });

    const response = await db.update(this.uuid, this.toJSON());

    return response;
  }

  /**
   * @function reload
   * @description reload attributes from database
   * @param {string} Table
   * @param {string} PartitionKey
   */
  async reload(Table, PartitionKey) {
    const db = new DB({
      Table,
      PartitionKey,
    });

    const {
      Glacier,
      Proxy,
      MachineMetadata,
    } = await db.fetch(this.uuid);

    this.glacier = Glacier;
    this.proxy = Proxy;
    this.machineMetadata = MachineMetadata;
  }

  /**
   * @function updateMediainfoDB
   * @description save the mediainfo to a separte DB table
   * @param {string} Table - Mediainfo table
   * @param {string} PartitionKey - Mediainfo parition key
   * @param {object} mediainfo - mediainfo
   */
  async updateMediainfoDB(Table, PartitionKey, mediainfo) {
    const db = new DB({
      Table,
      PartitionKey,
    });

    const response = await db.update(this.uuid, mediainfo);

    return response;
  }

  /**
   * @function fetchMediainfo
   * @description fetch mediainfo from DB
   */
  async fetchMediainfo(Table, PartitionKey) {
    const db = new DB({
      Table,
      PartitionKey,
    });

    const mediainfo = await db.fetch(this.uuid);

    return mediainfo;
  }

  async purgeDB(databases) {
    const promises = databases.map(params =>
      (new DB(params)).purge(this.uuid));

    await Promise.all(promises);
  }

  /**
   * @function setObjectLifecycle
   * @description set tags on the glacier object so it automatically transitions to Glacier object
   */
  async setObjectLifecycle() {
    try {
      const TagSet = [{
        Key: 'IngestCompleted',
        Value: 'true',
      }];

      const fileSet = this.glacier.files.map(x =>
        x.name);

      const Bucket = this.glacier.bucket;

      const promises = fileSet.map(Key =>
        VideoAsset.tagObject(Bucket, Key, TagSet));

      await Promise.all(promises);

      return Object.keys(fileSet);
    } catch (e) {
      e.message = `setObjectLifecyle: ${e.message}`;
      process.env.ENV_QUIET || console.error(e);
      throw e;
    }
  }
}

module.exports = {
  BaseAttributes,
  ProxyAttributes,
  GlacierAttributes,
  VideoAsset,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    BaseAttributes,
    ProxyAttributes,
    GlacierAttributes,
    VideoAsset,
  });
