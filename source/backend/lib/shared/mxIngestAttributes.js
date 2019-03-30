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
const MIME = require('mime');

const {
  mxCommonUtils,
} = require('./mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

/**
 * @mixins mxIngestAttributes
 * @description attributes class to load or create json definition file
 * @param {class} Base
 */
const mxIngestAttributes = Base => class extends Base {
  constructor(params = {}) {
    super(params);
    this.$ingestDate = (params.IngestDate) ? new Date(params.IngestDate) : undefined;
    this.$system = params.System || 'not specified';
    this.$description = params.Description || 'not specified';
    this.$comments = params.Comments || 'not specified';
    this.$category = params.Category || 'not specified';
    this.$name = params.Name;
    this.$files = params.Files || [];

    /* find the first video file from the json definition file list */
    this.$videoKey = this.files.map(x => x.name).find((file) => {
      const [
        type,
        subType,
      ] = (MIME.getType(file) || '/').split('/');

      return (type.toLowerCase() === 'video') || (subType.toLowerCase() === 'mxf');
    });
  }

  get system() {
    return this.$system;
  }

  get description() {
    return this.$description;
  }

  get comments() {
    return this.$comments;
  }

  get category() {
    return this.$category;
  }

  get name() {
    return this.$name;
  }

  get files() {
    return this.$files;
  }

  get videoKey() {
    return this.$videoKey;
  }

  get ingestDate() {
    return this.$ingestDate;
  }

  get ingestDateISOFormat() {
    return (this.ingestDate) ? this.ingestDate.toISOString() : undefined;
  }

  toJSON() {
    return Object.assign({}, super.toJSON(), {
      System: this.system,
      Description: this.description,
      Comments: this.comments,
      Category: this.category,
      Name: this.name,
      Files: this.files,
      IngestDate: this.ingestDateISOFormat,
    });
  }

  /**
   * @static
   * @function createJsonDocument
   * @description mock Json sidecar document
   * @param {string} Bucket
   * @param {string} Key
   * @param {string} [md5]
   * @param {string} [uuid]
   */
  static createJsonDocument(Bucket, Key, md5, uuid) {
    const name = Key.split('/').filter(x => x).pop();
    const basename = name.substr(0, name.lastIndexOf('.'));

    return {
      collectionUuid: X.uuid4(),
      collectionName: basename,
      files: [{
        checksums: [{
          type: 'MD5',
          value: md5 || X.zeroMD5(),
        }],
        location: Key,
        uuid: uuid || X.uuid4(),
      }],
    };
  }

  /**
   * @static
   * @function loadFromJsonFile
   * @description load and parse Json sidecar file
   * @param {string} Bucket - bucket
   * @param {string} Key - key to the sidecar file
   */
  static async loadFromJsonFile(Bucket, Key) {
    try {
      const response = await X.download(Bucket, Key, false);

      const json = JSON.parse(response.Body);

      const Files = json.files.reduce((acc, file) =>
        acc.concat({
          name: X.sanitizedKey(file.location || file.name),
          md5: (file.checksums.find(x => x.type.toLowerCase() === 'md5') || {}).value || X.zeroMD5(),
          uuid: file.uuid || X.zeroUUID(),
        }), []);

      /* MD5 of the Json definition file */
      const MD5 = X.toMD5String((response.Metadata || {}).md5 || response.ETag.match(/([0-9a-fA-F]{32})/)[1]);

      return {
        System: 'not specified',
        Bucket,
        Key,
        UUID: json.collectionUuid || json.uuid || json.legacyArchiveObjectUuid,
        MD5,
        LastModified: response.LastModified,
        ContentLength: response.ContentLength,
        ContentType: response.ContentType,
        IngestDate: json.ingestDate || json.archiveDate,
        Category: json.categoryName,
        Comments: json.comments,
        Description: json.collectionDescription || json.legacyArchiveName,
        Name: json.collectionName || json.objectName,
        Files,
        RawJson: json,
      };
    } catch (e) {
      throw e;
    }
  }
};

module.exports = {
  mxIngestAttributes,
};
