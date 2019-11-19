/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
const PATH = require('path');

const {
  Environment,
  StateData,
  DB,
  CommonUtils,
  SNS,
  IngestError,
} = require('m2c-core-lib');

const {
  MediaInfoCommand,
} = require('mediainfo');

const {
  Transcode,
} = require('./transcode');

const {
  ImageProcess,
} = require('./image-process');

const Outputs = require('./outputs');

/**
 * @class Ingest
 */
class Ingest {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }

    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'Ingest';
  }

  get stateData() {
    return this.$stateData;
  }

  parseObjectProps(data) {
    return Object.assign({
      key: data.Key,
      fileSize: data.ContentLength || data.Size,
      storageClass: data.StorageClass || 'STANDARD',
      lastModified: new Date(data.LastModified).getTime(),
    }, data.Metadata);
  }

  /**
   * @sync
   * @function createRecord
   * @description create ingest record
   */
  async createRecord() {
    const event = this.stateData.event;
    /* propagate any attributes set by the caller */
    const attributes = event.attributes;

    if (!this.stateData.uuid || !event.bucket || !event.key) {
      throw new IngestError('missing uuid, bucket and key');
    }

    const response = await CommonUtils.headObject(event.bucket, event.key);
    const mime = CommonUtils.getMime(event.key);

    /* try our best to find md5 from metadata, object-tags, and etag */
    const md5 = await this.findMd5(response);

    const merged = Object.assign(this.parseObjectProps(response), {
      key: event.key,
      basename: PATH.parse(event.key).name,
      md5,
      mime,
      type: CommonUtils.parseMimeType(mime),
      timestamp: (new Date()).getTime(),
      schemaVersion: 1,
      attributes,
    });

    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });

    await db.update(this.stateData.uuid, undefined, merged);

    this.stateData.setData('src', {
      bucket: event.bucket,
      key: event.key,
      type: merged.type,
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function startFixity
   * @description start fixity state machine
   */
  async startFixity() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  /**
   * @function checkFixityStatus
   * @description check fixity state machine status
   */
  async checkFixityStatus() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  /**
   * @function collectFixityResults
   * @description check fixity state machine status
   */
  async collectFixityResults() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  /**
   * @function runImageInfo
   * @description extract image information from JPEG and/or TIFF image
   */
  async runImageInfo() {
    let imageinfoJson;
    const promises = [];
    const src = (this.stateData.input || {}).src || {};
    const dst = this.makeOutputPath(src.key, 'image');
    const basename = PATH.parse(src.key).name;

    const imageinfo = await (new ImageProcess(this.stateData)).getImageInfo();

    if (imageinfo.preview) {
      const key = PATH.join(dst, Outputs.Types.Proxy, `${basename}.jpg`);
      promises.push(CommonUtils.upload({
        Bucket: Environment.Proxy.Bucket,
        Key: key,
        Body: imageinfo.preview,
        ContentType: 'image/jpeg',
        ContentDisposition: `attachment; filename="${PATH.parse(key).base}"`,
        ServerSideEncryption: 'AES256',
      }));
    }

    if (imageinfo.thumbnail) {
      const key = PATH.join(dst, Outputs.Types.Proxy, `${basename}_thumbnail.jpg`);
      promises.push(CommonUtils.upload({
        Bucket: Environment.Proxy.Bucket,
        Key: key,
        Body: imageinfo.thumbnail,
        ContentType: 'image/jpeg',
        ContentDisposition: `attachment; filename="${PATH.parse(key).base}"`,
        ServerSideEncryption: 'AES256',
      }));
    }

    if (imageinfo.exif) {
      imageinfoJson = PATH.join(this.makeOutputPath(src.key, 'imageinfo'), 'output.json');
      promises.push(CommonUtils.upload({
        Bucket: Environment.Proxy.Bucket,
        Key: imageinfoJson,
        Body: JSON.stringify(imageinfo.exif, null, 2),
        ContentType: 'application/json',
        ContentDisposition: `attachment; filename="${PATH.parse(imageinfoJson).base}"`,
        ServerSideEncryption: 'AES256',
      }));
      /* update database */
      promises.push((new DB({
        Table: Environment.DynamoDB.Ingest.Table,
        PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
      })).update(this.stateData.uuid, undefined, {
        imageinfo: imageinfo.exif,
      }, false));
    }

    await Promise.all(promises);

    this.stateData.setData('image', {
      destination: `${dst}/`,
    });

    this.stateData.setData('imageinfo', {
      output: imageinfoJson,
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @async
   * @function runMediainfo
   * @description state to run mediainfo and save the info to s3 and dynamodb
   */
  async runMediainfo() {
    const src = (this.stateData.input || {}).src || {};

    /* #1: run mediainfo */
    const mi = new MediaInfoCommand();
    const fullData = await mi.analyze({
      Bucket: src.bucket,
      Key: src.key,
    });

    /* #2: update table */
    /* #3: store original mediainfo xml to s3 */
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });

    const xmlKey =
      PATH.join(this.makeOutputPath(src.key, 'mediainfo'), 'output.xml');

    await Promise.all([
      this.uploadMediainfoXml(
        Environment.Proxy.Bucket,
        xmlKey,
        mi.toXML()
      ),
      db.update(this.stateData.uuid, undefined, {
        mediainfo: fullData.mediainfo,
      }, false),
    ]);

    this.stateData.setData('mediainfo', Object.assign({
      output: xmlKey,
    }, mi.miniData));

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @async
   * @function startTranscode
   * @description state to start trasncode process
   */
  async startTranscode() {
    const src = (this.stateData.input || {}).src || {};
    const mediainfo = (this.stateData.input || {}).mediainfo || {};

    const instance = new Transcode(this.stateData.uuid, Object.assign({}, src, {
      mediainfo,
    }));

    const response = await instance.submit();

    this.stateData.setStarted();

    this.stateData.setData('transcode', {
      jobId: response.jobId,
      destination: response.destination,
    });

    this.stateData.setData('mediainfo', {
      output: mediainfo.output,
    }, false);

    return this.stateData.toJSON();
  }

  /**
   * @async
   * @function checkTranscodeStatus
   * @description state to check transcoding status
   */
  async checkTranscodeStatus() {
    const data = ((this.stateData.input || {}).transcode || {});

    const instance = new Transcode(this.stateData.uuid, data);

    const response = await instance.getJob();

    if (response.status === StateData.Statuses.Completed) {
      this.stateData.setCompleted();
    } else {
      this.stateData.setProgress(response.percentage);
    }

    return this.stateData.toJSON();
  }

  /**
   * @async
   * @function updateRecord
   * @description state to update record in dynamodb
   */
  async updateRecord() {
    /* merge data under input.next */
    const data = this.stateData.input.reduce((a0, c0) => {
      const all = {};
      Object.keys(c0.next).forEach((k) => {
        all[k] = c0.next[k];
      });
      return Object.assign(a0, all);
    }, {});

    if (!data.src) {
      throw new IngestError('fail to find input src');
    }

    const dst = (data.transcode || data.image || {}).destination;
    if (!dst) {
      throw new IngestError('fail to find proxy destination');
    }

    const bucket = Environment.Proxy.Bucket;
    const ots = [
      Outputs.Types.Proxy,
      Outputs.Types.Aiml,
      Outputs.Types.Prod,
    ];

    const proxies = [];
    while (ots.length) {
      const ot = ots.shift();
      const responses = await CommonUtils.listObjects(bucket, PATH.join(dst, ot));
      while (responses.length) {
        const response = responses.shift();
        const mime = CommonUtils.getMime(response.Key);
        proxies.push(Object.assign(this.parseObjectProps(response), {
          key: response.Key,
          outputType: ot,
          mime,
          type: CommonUtils.parseMimeType(mime),
        }));
      }
    }

    if (!proxies.length) {
      throw new IngestError(`fail to find proxy under ${bucket}/${dst}`);
    }

    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });

    await db.update(this.stateData.uuid, undefined, {
      proxies,
    }, false);

    await CommonUtils.tagObject(data.src.bucket, data.src.key, [{
      Key: 'IngestCompleted',
      Value: 'true',
    }]);

    this.stateData.resetAllData();

    Object.keys(data).forEach(x =>
      this.stateData.setData(x, data[x], false));

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @async
   * @function onCompleted
   * @description state to send notification
   */
  async onCompleted() {
    return SNS.send(`ingest: ${this.stateData.uuid}`, this.stateData.toJSON()).catch(() => false);
  }

  /**
   * @function makeOutputPath
   * @description make output path prefix based on the source key,
   * in a format of {UUID}/{PATH}/{KEYWORD}/
   * @param {string} src - source key
   * @param {string} keyword - used to append to the path
   */
  makeOutputPath(src, keyword = '') {
    const {
      dir,
    } = PATH.parse(src);

    return PATH.join(this.stateData.uuid, dir, keyword);
  }

  /**
   * @async
   * @function uploadMediainfoXml
   * @description upload mediainfo xml file to proxy bucket
   * @param {string} bucket
   * @param {string} key
   * @param {string} xml - xml body
   */
  async uploadMediainfoXml(bucket, key, xml) {
    return CommonUtils.upload({
      Bucket: bucket,
      Key: key,
      Body: xml,
      ContentType: 'application/xml',
      ContentDisposition: `attachment; filename="${PATH.parse(key).base}"`,
      ServerSideEncryption: 'AES256',
    });
  }

  async findMd5(data) {
    /* #1: x-amz-metadat-md5 is set, we are all good */
    if (((data || {}).Metadata || {}).md5) {
      return data.Metadata.md5;
    }

    /* #2: try object tagging */
    const src = (this.stateData.input || {}).src || this.stateData.event;
    const response = await CommonUtils.getTags(src.bucket, src.key).catch(() => undefined);
    const chksum = ((response || {}).TagSet || []).find(x =>
      x.Key === 'computed-md5');
    if (chksum && chksum.Value.match(/^([0-9a-fA-F]{32})$/)) {
      return chksum.Value;
    }

    /* #3: try ETag iff it is NOT multipart upload and SSE is disable or AES256 */
    if (!data.ServerSideEncryption
      || data.ServerSideEncryption.toLowerCase() === 'aes256') {
      /* the regex screens any multipart upload ETag */
      const matched = data.ETag.match(/^"([0-9a-fA-F]{32})"$/);
      if (matched) {
        return matched[1];
      }
    }

    return undefined;
  }
}

module.exports = {
  Ingest,
};
