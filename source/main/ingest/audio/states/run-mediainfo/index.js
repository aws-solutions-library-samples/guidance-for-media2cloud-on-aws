// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  DB,
  CommonUtils,
  MimeTypeHelper,
  Environment,
  StateData,
  IngestError,
} = require('core-lib');
const {
  MediaInfoCommand,
} = require('mediainfo');

const CATEGORY = 'mediainfo';
const CATEGORY_TRANSCODE = 'transcode';
const XML_OUTPUT = `${CATEGORY}.xml`;
const JSON_OUTPUT = `${CATEGORY}.json`;
const OUTPUT_TYPE_PROXY = 'proxy';
const BASENAME_COVER_ART = 'cover';

class StateRunMediaInfo {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new IngestError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateRunMediaInfo';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const src = this.stateData.input || {};
    if (!src.destination || !src.destination.bucket || !src.destination.prefix) {
      throw new IngestError('missing destination');
    }
    /* #1: run mediainfo */
    const mi = new MediaInfoCommand();
    const fullData = await mi.analyze({
      Bucket: src.bucket,
      Key: src.key,
    });
    /* #2: store coverData to proxy if any */
    await this.uploadCoverData(src.destination, fullData);
    /* #3: store mediainfo.json and mediainfo.xml */
    const mediainfo = await this.uploadMediainfoFiles(src.destination, fullData, mi.rawXml);
    /* #4: update table */
    const parsed = mi.miniData;
    const duration = ((parsed.container[0] || {}).duration || 0) * 1000;
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.update(this.stateData.uuid, undefined, {
      mediainfo,
      duration,
    }, false);
    /* #5: update state data */
    this.stateData.input.duration = duration;
    this.stateData.setData(CATEGORY, {
      ...parsed,
      output: mediainfo,
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async uploadCoverData(dest, data) {
    const track = data.mediaInfo.media.track.find(x => x.coverData !== undefined);
    if (!track) {
      return undefined;
    }
    /* remove image from data */
    const buf = Buffer.from(track.coverData, 'base64');
    delete track.coverData;
    const ext = MimeTypeHelper.getExtensionByMime(track.coverMime);
    if (!ext) {
      return undefined;
    }
    /* upload cover art */
    const bucket = dest.bucket;
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const prefix = PATH.join(dest.prefix, CATEGORY_TRANSCODE, OUTPUT_TYPE_PROXY, '/');
    const name = `${BASENAME_COVER_ART}.${ext}`;
    return CommonUtils.uploadFile(bucket, prefix, name, buf)
      .then(() => {
        // eslint-disable-next-line
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const output = PATH.join(prefix, name);
        return output;
      })
      .catch(e => console.error(e));
  }

  async uploadMediainfoFiles(dest, json, xml) {
    const bucket = dest.bucket;
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const prefix = PATH.join(dest.prefix, CATEGORY);
    return Promise.all([
      CommonUtils.uploadFile(bucket, prefix, JSON_OUTPUT, json)
        .then(() => {
          // eslint-disable-next-line
          // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          const output = PATH.join(prefix, JSON_OUTPUT);
          return output;
        })
        .catch(e => console.error(e)),
      CommonUtils.uploadFile(bucket, prefix, XML_OUTPUT, xml)
        .then(() => {
          // eslint-disable-next-line
          // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          const output = PATH.join(prefix, XML_OUTPUT);
          return output;
        })
        .catch(e => console.error(e)),
    ]);
  }
}

module.exports = StateRunMediaInfo;
