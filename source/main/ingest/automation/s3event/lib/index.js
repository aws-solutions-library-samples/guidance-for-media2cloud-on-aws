/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
const AWS = require('aws-sdk');
const PATH = require('path');

const {
  Environment,
  CommonUtils,
} = require('core-lib');

/**
 * @class FileType
 * @description parse file type
 */
class FileType {
  static get Unknown() {
    return -1;
  }

  static get Folder() {
    return 0;
  }

  static get Media() {
    return 1;
  }

  static get Json() {
    return 2;
  }

  static isFolder(x) {
    return x === FileType.Folder;
  }

  static isMedia(x) {
    return x === FileType.Media;
  }

  static isJson(x) {
    return x === FileType.Json;
  }

  static isUnknown(x) {
    return x === FileType.Unknown;
  }
}

/**
 * @class S3Event
 * @description handle s3.OBJECTCREATED events
 */
class S3Event {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;

    const {
      s3,
    } = (event.Records[0] || {});

    this.$bucket = s3.bucket.name;
    this.$key = s3.object.key;
    this.$accountId = context.invokedFunctionArn.split(':')[4];
    this.$type = S3Event.parseFileType(this.$key);
    this.$uuid = undefined;
  }

  /**
   * @static
   * @function parseFileType
   * @param {string} key
   * @returns {number} FileType.TYPE
   */
  static parseFileType(key) {
    let type = FileType.Unknown;

    if (key.substr(-1) === '/') {
      return FileType.Folder;
    }

    const {
      ext,
    } = PATH.parse(key);

    switch (ext.toLowerCase()) {
      /* definition file extension */
      case '.json':
        type = FileType.Json;
        break;
      /* media file extension */
      case '.mp4':
      case '.mov':
      case '.wmv':
      case '.mxf':
      case '.ts':
      case '.mpg':
      case '.mpeg':
      default:
        type = FileType.Media;
        break;
    }
    return type;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get accountId() {
    return this.$accountId;
  }

  get bucket() {
    return this.$bucket;
  }

  get key() {
    return this.$key;
  }

  get type() {
    return this.$type;
  }

  get uuid() {
    return this.$uuid;
  }

  set uuid(val) {
    this.$uuid = val;
  }

  /**
   * @function onMediaFileArrival
   * @description handle media file event. create Json definition file if necessary.
   */
  async onMediaFileArrival() {
    /* if 'x-amz-web-upload' is present, it is uploaded by web ui. */
    /* skip the creation of JSON definition file */
    const key = CommonUtils.unescapeS3Character(this.key);

    const {
      ETag,
      Metadata,
    } = await CommonUtils.headObject(this.bucket, key);

    if (Metadata['web-upload']) {
      console.log(`${key} uploaded from web UI. nothing to do`);
      return undefined;
    }

    const uuid = Metadata.uuid || CommonUtils.uuid4();
    /* check if ETag is equal to MD5 of the entire file or not */
    let md5 = Metadata.md5;
    if (ETag.indexOf('-') < 0) {
      md5 = md5 || Buffer.from(ETag.match(/([0-9a-fA-F]{32})/)[1], 'hex').toString('base64');
    }

    const bucket = Environment.Proxy.Bucket;
    const prefix = CommonUtils.makeSafeOutputPrefix(uuid, key);
    const params = {
      input: {
        uuid,
        bucket: this.bucket,
        key,
        md5,
        destination: {
          bucket,
          prefix,
        },
      },
    };
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    return step.startExecution({
      input: JSON.stringify(params),
      stateMachineArn: `arn:aws:states:${process.env.AWS_REGION}:${this.accountId}:stateMachine:${Environment.StateMachines.Ingest}`,
    }).promise();
  }

  /**
   * @function onJsonFileArrival
   * @description handle Json definition event. start ingest state machine.
   */
  async onJsonFileArrival() {
    const key = CommonUtils.unescapeS3Character(this.key);
    const data = await this.readFromJsonFile(this.bucket, key);
    const bucket = Environment.Proxy.Bucket;
    const prefix = CommonUtils.makeSafeOutputPrefix(data.uuid, key);
    const params = {
      input: {
        uuid: data.uuid,
        bucket: this.bucket,
        key: data.key,
        md5: data.md5,
        attributes: data.attributes,
        destination: {
          bucket,
          prefix,
        },
      },
    };
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    return step.startExecution({
      input: JSON.stringify(params),
      stateMachineArn: `arn:aws:states:${process.env.AWS_REGION}:${this.accountId}:stateMachine:${Environment.StateMachines.Ingest}`,
    }).promise();
  }

  /**
   * @function readFromJsonFile
   * @description read definition from Json file
   * @param {string} bucket
   * @param {string} key
   */
  async readFromJsonFile(bucket, key) {
    const response = await CommonUtils.download(bucket, key, false);

    let json = JSON.parse(response.Body);
    json = json.legacyArchiveObject || json;

    /* find the most possible video file from the Json */
    const videos = json.files.filter((x) => {
      const type = CommonUtils.parseMimeType(CommonUtils.getMime(x.location || x.name));
      return type === 'video' || type === 'mxf';
    });

    /* find largest file */
    let video = videos.reduce((prev, cur) => {
      if (Number.parseInt(cur.sizeBytes || 0, 10) > Number.parseInt(prev.sizeBytes || 0, 10)) {
        return cur;
      }
      return prev;
    }, {});

    video = video || videos.shift();
    if (!video) {
      throw new Error(`failed to find video from Json file, ${key}`);
    }

    if (!video.uuid || !video.location || !video.name) {
      throw new Error(`missing uuid, location, or name from json file, ${key}`);
    }

    /* extract md5 from Json file */
    const md5 = ((video.checksums || []).filter(x =>
      x.type === 'MD5').shift() || {}).value;

    /* make sure md5 is valid */
    if (md5 && !md5.match(/([0-9a-fA-F]{32})/)) {
      throw new Error(`not a valid md5 format, ${md5}, ${video.location || video.name}`);
    }

    let ingestDate = (json.ingestDate || json.archiveDate);
    ingestDate = (ingestDate && new Date(ingestDate).getTime()) || undefined;

    return CommonUtils.neat({
      uuid: video.uuid,
      key: video.location || video.name,
      md5,
      attributes: {
        collectionUuid: json.collectionUuid || json.legacyArchiveObjectUuid,
        ingestDate,
        category: json.categoryName,
        comments: json.comments,
        description: json.collectionDescription || json.legacyArchiveName,
        name: json.collectionName || json.objectName,
      },
    });
  }
}

module.exports = {
  FileType,
  S3Event,
};
