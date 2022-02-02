// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  DB,
  CommonUtils,
  Environment,
  StateData,
  FrameCaptureMode,
  AnalysisTypes,
  IngestError,
} = require('core-lib');

class StateCreateRecord {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateCreateRecord';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const uuid = this.stateData.uuid;
    const src = this.stateData.input;
    if (!uuid || !src.bucket || !src.key) {
      throw new IngestError('missing uuid, bucket and key');
    }
    const response = await CommonUtils.headObject(src.bucket, src.key);
    const mime = src.mime || CommonUtils.getMime(src.key);
    /* try our best to find md5 from metadata, object-tags, and etag */
    const md5 = await this.findMd5(response);
    /* parse frame capture mode settings */
    src.aiOptions = this.parseFrameCaptureMode(src.aiOptions);
    /* update type based on mime */
    src.type = CommonUtils.parseMimeType(mime);
    /* make sure destination.bucket and prefix are set */
    if (!(src.destination || {}).bucket || !(src.destination || {}).prefix) {
      src.destination = {
        bucket: Environment.Proxy.Bucket,
        prefix: CommonUtils.makeSafeOutputPrefix(uuid, src.key),
        ...src.destination,
      };
    }
    /* create ddb record */
    const status = StateData.Statuses.IngestStarted;
    const overallStatus = StateData.Statuses.Processing;
    const merged = {
      ...this.parseObjectProps(response),
      bucket: src.bucket,
      key: src.key,
      basename: PATH.parse(src.key).name,
      md5,
      mime,
      type: src.type,
      timestamp: (new Date()).getTime(),
      schemaVersion: 1,
      attributes: src.attributes,
      aiOptions: src.aiOptions,
      status,
      overallStatus,
      executionArn: this.stateData.event.executionArn,
      destination: src.destination,
    };
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.update(uuid, undefined, merged);

    this.stateData.setCompleted(status);
    return this.stateData.toJSON();
  }

  async findMd5(data) {
    /* #1: x-amz-metadat-md5 is set, we are all good */
    if (((data || {}).Metadata || {}).md5) {
      return data.Metadata.md5;
    }

    /* #2: try object tagging */
    const src = this.stateData.input || {};
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

  parseObjectProps(data) {
    return Object.assign({
      key: data.Key,
      fileSize: data.ContentLength || data.Size,
      storageClass: data.StorageClass || 'STANDARD',
      lastModified: new Date(data.LastModified).getTime(),
    }, data.Metadata);
  }

  parseFrameCaptureMode(aiOptions) {
    const options = aiOptions;
    /* auto select frameCaptureMode if not defined */
    if (options
      && options[AnalysisTypes.Rekognition.CustomLabel]
      && options.customLabelModels
      && !options.frameCaptureMode) {
      options.frameCaptureMode = FrameCaptureMode.MODE_1F_EVERY_2S;
    }
    /* if frameCaptureMode is set to MODE_NODE, disable customlabel and customLabelModels */
    if (options
      && options.frameCaptureMode === FrameCaptureMode.MODE_NONE) {
      options[AnalysisTypes.Rekognition.CustomLabel] = false;
      options.customLabelModels = undefined;
    }
    return options;
  }
}

module.exports = StateCreateRecord;
