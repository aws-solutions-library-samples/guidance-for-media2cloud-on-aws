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
 * @mixins mxArchiveAttributes
 * @description archive attributes class to load or create archive definition file
 * @param {class} Base
 */
const mxArchiveAttributes = Base => class extends Base {
  constructor(params = {}) {
    super(params);
    const {
      System,
      ArchiveDate,
      Description,
      Comments,
      Category,
      Name,
      Barcode,
      Files = [],
    } = params;

    this.$archiveDate = (ArchiveDate) ? new Date(ArchiveDate) : undefined;
    this.$system = System;
    this.$description = Description;
    this.$comments = Comments;
    this.$category = Category;
    this.$name = Name;
    this.$barcode = Array.isArray(Barcode) ? Barcode.join(', ') : Barcode;
    this.$files = Files;

    /* find the first video file from the archive file list */
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

  get barcode() {
    return this.$barcode;
  }

  get files() {
    return this.$files;
  }

  get videoKey() {
    return this.$videoKey;
  }

  get archiveDate() {
    return this.$archiveDate;
  }

  get archiveDateISOFormat() {
    return (this.archiveDate) ? this.archiveDate.toISOString() : undefined;
  }

  toJSON() {
    return Object.assign({}, super.toJSON(), {
      System: this.system,
      Description: this.description,
      Comments: this.comments,
      Category: this.category,
      Name: this.name,
      Barcode: this.barcode,
      Files: this.files,
      ArchiveDate: this.archiveDateISOFormat,
    });
  }

  /**
   * @static
   * @function createDIVADocument
   * @description mock DIVA sidecar document
   * @param {string} Bucket
   * @param {string} Key
   * @param {string} [md5]
   * @param {string} [uuid]
   */
  static createDIVADocument(Bucket, Key, md5, uuid) {
    const name = Key.split('/').filter(x => x).pop();
    const basename = name.substr(0, name.lastIndexOf('.'));

    return {
      archiveDate: new Date().toISOString(),
      categoryName: basename,
      comments: 'No comments',
      legacyArchiveName: 'Not specified',
      files: [{
        checksums: [{
          type: 'MD5',
          value: md5 || X.zeroMD5(),
        }],
        name: Key,
        uuid: uuid || X.uuid4(),
      }],
      objectName: basename,
      tapeBarcodes: [
        Math.floor((Math.random() * 10000)).toString(),
      ],
      targetInfo: {
        bucketName: Bucket,
        endpoint: X.unsignedUrl(Bucket, Key),
        equalsToDemarcationStorage: false,
        region: process.env.AWS_REGION,
        type: 'S3',
      },
      legacyArchiveObjectUuid: X.uuid4(),
    };
  }

  /**
   * @static
   * @function loadFromDIVA
   * @description load and parse DIVA sidecar file
   * @param {string} Bucket - bucket
   * @param {string} Key - key to the sidecar file
   */
  static async loadFromDIVA(Bucket, Key) {
    try {
      const response = await X.download(Bucket, Key, false);

      const {
        Body,
        LastModified,
        ContentLength,
        ContentType,
        ETag,
        Metadata = {},
      } = response;

      const RawData = JSON.parse(Body);

      const {
        archiveDate: ArchiveDate,
        categoryName: Category,
        comments: Comments,
        legacyArchiveName, divaName,
        tapeBarcodes: Barcode,
        objectName: Name,
        legacyArchiveObjectUuid, uuid,
        files,
      } = RawData;

      const Files = files.reduce((acc, file) =>
        acc.concat({
          name: X.sanitizedKey(file.name),
          md5: (file.checksums.find(x => x.type.toLowerCase() === 'md5') || {}).value || X.zeroMD5(),
          uuid: file.uuid || X.zeroUUID(),
        }), []);

      /* MD5 of the archive definition file */
      const {
        md5,
      } = Metadata;

      const MD5 = X.toMD5String(md5 || ETag.match(/([0-9a-fA-F]{32})/)[1]);

      return {
        System: 'DIVA',
        Bucket,
        Key,
        UUID: legacyArchiveObjectUuid || uuid,
        MD5,
        LastModified,
        ContentLength,
        ContentType,
        ArchiveDate,
        Category,
        Comments,
        Description: legacyArchiveName || divaName,
        Barcode,
        Name,
        Files,
        RawData,
      };
    } catch (e) {
      throw e;
    }
  }
};

module.exports = {
  mxArchiveAttributes,
};
