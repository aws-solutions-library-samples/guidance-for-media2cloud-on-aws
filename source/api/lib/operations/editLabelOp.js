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
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-nested-ternary */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
// const AWS = require('aws-sdk');
const PATH = require('path');

const {
  BaseIndex,
  CommonUtils,
  Environment,
  DB,
  WebVttTrack,
} = require('m2c-core-lib');

const {
  BaseOp,
} = require('./baseOp');

/**
 * @class EditLabelOp
 * @description manage label editing workflow
 */
class EditLabelOp extends BaseOp {
  async onGET() {
    throw new Error('EditLabelOp.onGET not impl');
  }

  async onDELETE() {
    throw new Error('EditLabelOp.onDELETE not impl');
  }

  /**
   * @function validatePostRequest
   * @description perform input validation
   * @param {object} params
   */
  validatePostRequest(params = {}) {
    if (!params.uuid || !CommonUtils.validateUuid(params.uuid)) {
      throw new Error('invalid uuid');
    }

    if ([
      'transcript',
      'comprehend',
      'rekognition',
      'rekog-image',
    ].indexOf(params.trackCategory) < 0) {
      throw new Error('invalid trackCategory');
    }

    if ([
      'audio',
      'video',
      'image',
    ].indexOf(params.trackType) < 0) {
      throw new Error('invalid trackType');
    }

    if (!/^[a-zA-Z]+$/.test(params.trackGroup)) {
      throw new Error('invalid trackGroup');
    }

    if (typeof params.track !== 'object') {
      throw new Error('invalid track params');
    }

    if ([
      'name',
      'action',
      'applyAll',
    ].filter(x => (params.track || {})[x] === undefined).length > 0) {
      throw new Error('invalid track params');
    }

    if (!params.track.name.original || !params.track.name.modified) {
      throw new Error('invalid track params');
    }

    if (!Array.isArray(params.track[params.track.action])) {
      throw new Error('invalid track params');
    }

    if (params.track[params.track.action].filter(x =>
      (typeof x !== 'object' || typeof x.startTime !== 'number' || typeof x.endTime !== 'number')).length > 0) {
      throw new Error('invalid track params');
    }

    return params;
  }

  /**
   * @async
   * @function onPOST
   * @description handle POST request
   */
  async onPOST() {
    const params = this.validatePostRequest(this.request.body || {});
    const data = await this.fetchDB(params);
    const promise = (params.track.action === 'delete')
      ? this.onDeleteLabel(params, data)
      : (params.track.action === 'apply')
        ? this.onApplyLabel(params, data)
        : undefined;

    const response = await promise;

    /* update elasticsearch engine */
    await this.updateDocument(params, response.metadata);

    return super.onPOST(response);
  }

  /**
   * @async
   * @function fetchDB
   * @description fetch row from AI/ML dynamodb table
   * @param {object} params
   */
  async fetchDB(params) {
    const db = new DB({
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    });
    const data = await db.fetch(params.uuid, params.trackType, params.trackCategory);
    return data[params.trackCategory][params.trackGroup];
  }

  /**
   * @async
   * @function updateDocument
   * @description update elasticsearch document
   * @param {object} params
   * @param {object} [metadata]
   */
  async updateDocument(params, metadata = {}) {
    const deleted = [];
    const added = [];
    Object.keys(metadata).forEach((x) => {
      if (metadata[x].deleted) {
        deleted.push(x.toLowerCase());
      }
      if (metadata[x].added) {
        added.push(x.toLowerCase());
      }
    });

    if (deleted.length + added.length === 0) {
      return true;
    }

    const es = new BaseIndex();
    const document = await es.getDocument(params.uuid);
    document[params.trackGroup] = document[params.trackGroup] || [];

    while (deleted.length) {
      const name = deleted.shift();
      document[params.trackGroup] = document[params.trackGroup].filter(x => x !== name);
    }
    while (added.length) {
      const name = added.shift();
      document[params.trackGroup].push(name);
    }
    document[params.trackGroup] = [...new Set(document[params.trackGroup])];

    return es.indexDocument(params.uuid, {
      [params.trackGroup]: document[params.trackGroup],
    }).catch(() => false).then(() => true);
  }

  /**
   * @async
   * @function upload
   * @description upload to s3
   * @param {string} bucket
   * @param {string} key
   * @param {string|object} body
   */
  async upload(bucket, key, body) {
    const parsed = PATH.parse(key);
    const type = (parsed.ext === '.json')
      ? 'application/json'
      : (parsed.ext === '.vtt')
        ? 'text/vtt'
        : undefined;

    return CommonUtils.upload({
      Bucket: bucket,
      Key: key,
      ContentType: type,
      ContentDisposition: `attachment; filename="${parsed.base}"`,
      ServerSideEncryption: 'AES256',
      Body: (typeof body === 'string')
        ? body
        : JSON.stringify(body, null, 2),
    });
  }

  /**
   * @function parseMetadataTrack
   * @description parse metadata track based on track.action and return original and modified lists
   * @param {object} params
   * @param {object} metadata
   * @returns {object} response
   * @returns {Array} response.original
   * @returns {Array} response.modified
   */
  parseMetadataTrack(params, metadata) {
    let original = metadata.slice(0);
    const modified = [];
    const actions = params.track[params.track.action].slice(0);
    while (actions.length) {
      const action = actions.shift();
      let list = [];
      while (original.length) {
        const m = original.shift();
        if (m.begin >= action.startTime && m.begin <= action.endTime) {
          modified.push(m);
        } else {
          list.push(m);
        }
      }
      original = list;
      list = [];
    }

    if (params.track.action === 'delete') {
      modified.length = 0;
    }

    return {
      original,
      modified,
    };
  }

  /**
   * @async
   * @function processMetadataTrack
   * @description process metadata track.
   * download and upload (or create) metadata tracks based on track.action.
   * @param {object} params
   * @param {object} metadata
   * @returns {object} response
   * @returns {object} response.original[deleted|modified|error]
   * @returns {object} response.modified[added|error]
   */
  async processMetadataTrack(params, data) {
    try {
      const responseData = {};
      const promises = [];

      const bucket = Environment.Proxy.Bucket;
      const obasename = params.track.name.original.toLowerCase().replace(/\s/g, '_');
      const okey = `${data.metadata}/${obasename}.json`;

      const parsed =
        this.parseMetadataTrack(params, JSON.parse(await CommonUtils.download(bucket, okey)));
      if (parsed.original.length) {
        promises.push(this.upload(bucket, okey, parsed.original));
        responseData[params.track.name.original] = {
          modified: okey,
        };
      } else {
        promises.push(CommonUtils.deleteObject(bucket, okey));
        responseData[params.track.name.original] = {
          deleted: okey,
        };
      }

      const nbasename = params.track.name.modified.toLowerCase().replace(/\s/g, '_');
      const nkey = `${data.metadata}/${nbasename}.json`;
      if (parsed.modified.length) {
        promises.push(this.upload(bucket, nkey, parsed.modified));
        responseData[params.track.name.modified] = {
          added: nkey,
        };
      }
      await Promise.all(promises);
      return responseData;
    } catch (e) {
      return {
        [params.track.name.original]: {
          error: e.message,
        },
      };
    }
  }

  /**
   * @function parseVttTrack
   * @description parse webvtt track based on track.action and return original and modified lists
   * @param {object} params
   * @param {string} body
   * @returns {object} response
   * @returns {Array} response.original
   * @returns {Array} response.modified
   */
  parseVttTrack(params, body) {
    let original = WebVttTrack.parse(body);
    const modified = new WebVttTrack();

    const actions = params.track[params.track.action].slice(0);
    while (actions.length) {
      const action = actions.shift();
      const track = new WebVttTrack();

      while (original.length) {
        const cue = original.shift();
        if (cue.begin >= action.startTime && cue.begin <= action.endTime) {
          cue.text = [
            `<c.${params.trackGroup}>${params.track.name.modified}</c>`,
            '<c.edited><i>(Edited)</i></c>',
          ].join('\n');
          modified.push(cue);
        } else {
          track.push(cue);
        }
      }
      original = track;
    }

    if (params.track.action === 'delete') {
      modified.length = 0;
    }

    return {
      original,
      modified,
    };
  }

  /**
   * @async
   * @function processVttTrack
   * @description process webvtt track.
   * download and upload (or create) webvtt tracks based on track.action.
   * @param {object} params
   * @param {object} data
   * @returns {object} response
   * @returns {object} response.original[deleted|modified|error]
   * @returns {object} response.modified[added|error]
   */
  async processVttTrack(params, data) {
    try {
      const responseData = {};
      const promises = [];

      const bucket = Environment.Proxy.Bucket;
      const obasename = params.track.name.original.toLowerCase().replace(/\s/g, '_');
      const okey = `${data.vtt}/${obasename}.vtt`;

      const parsed = this.parseVttTrack(params, await CommonUtils.download(bucket, okey));
      if (parsed.original.length) {
        promises.push(this.upload(bucket, okey, parsed.original.toString()));
        responseData[params.track.name.original] = {
          modified: okey,
        };
      } else {
        promises.push(CommonUtils.deleteObject(bucket, okey));
        responseData[params.track.name.original] = {
          deleted: okey,
        };
      }

      const nbasename = params.track.name.modified.toLowerCase().replace(/\s/g, '_');
      const nkey = `${data.vtt}/${nbasename}.vtt`;
      if (parsed.modified.length) {
        promises.push(this.upload(bucket, nkey, parsed.modified.toString()));
        responseData[params.track.name.modified] = {
          added: nkey,
        };
      }
      await Promise.all(promises);
      return responseData;
    } catch (e) {
      return {
        [params.track.name.original]: {
          error: e.message,
        },
      };
    }
  }

  /**
   * @async
   * @functiom deleteAll
   * @description delete metadata and vtt tracks associated to the track name.
   * @param {object} params
   * @param {object} data
   */
  async deleteAll(params, data) {
    const bucket = Environment.Proxy.Bucket;
    const basename = params.track.name.original.toLowerCase().replace(/\s/g, '_');
    const metadataKey = `${data.metadata}/${basename}.json`;
    const vttKey = `${data.vtt}/${basename}.vtt`;

    await Promise.all([
      metadataKey,
      vttKey,
    ].map(x => CommonUtils.deleteObject(bucket, x)));

    return {
      metadata: {
        [params.track.name.original]: {
          deleted: metadataKey,
        },
      },
      vtt: {
        [params.track.name.original]: {
          deleted: vttKey,
        },
      },
    };
  }

  /**
   * @async
   * @functiom deletePartial
   * @description partially delete metadata and vtt data within the track.
   * @param {object} params
   * @param {object} data
   */
  async deletePartial(params, data) {
    return this.applyPartial(params, data);
  }

  /**
   * @async
   * @functiom onDeleteLabel
   * @description determine if delete all or partially delete track
   * @param {object} params
   * @param {object} data
   */
  async onDeleteLabel(params, data) {
    return (params.track.applyAll)
      ? this.deleteAll(params, data)
      : this.deletePartial(params, data);
  }

  /**
   * @async
   * @functiom replaceMetadataTrack
   * @description replace the entire metadata track with new name
   * @param {object} params
   * @param {object} data
   */
  async replaceMetadataTrack(params, data) {
    try {
      const bucket = Environment.Proxy.Bucket;
      const obasename = params.track.name.original.toLowerCase().replace(/\s/g, '_');
      const okey = `${data.metadata}/${obasename}.json`;

      const nbasename = params.track.name.modified.toLowerCase().replace(/\s/g, '_');
      const nkey = `${data.metadata}/${nbasename}.json`;

      await CommonUtils.copyObject(`${bucket}/${okey}`, bucket, nkey);
      await CommonUtils.deleteObject(bucket, okey);

      return {
        [params.track.name.original]: {
          deleted: okey,
        },
        [params.track.name.modified]: {
          added: nkey,
        },
      };
    } catch (e) {
      return {
        [params.track.name.original]: {
          error: e.message,
        },
      };
    }
  }

  /**
   * @async
   * @functiom replaceVttTrack
   * @description replace the entire webvtt track with new name
   * @param {object} params
   * @param {object} data
   */
  async replaceVttTrack(params, data) {
    try {
      const bucket = Environment.Proxy.Bucket;
      const obasename = params.track.name.original.toLowerCase().replace(/\s/g, '_');
      const okey = `${data.vtt}/${obasename}.vtt`;

      const nbasename = params.track.name.modified.toLowerCase().replace(/\s/g, '_');
      const nkey = `${data.vtt}/${nbasename}.vtt`;

      const track = WebVttTrack.parse(await CommonUtils.download(bucket, okey));
      track.cues.forEach((cue) => {
        cue.text = [
          `<c.${params.trackGroup}>${params.track.name.modified}</c>`,
          '<c.edited><i>(Edited)</i></c>',
        ].join('\n');
      });
      await Promise.all([
        this.upload(bucket, nkey, track.toString()),
        CommonUtils.deleteObject(bucket, okey),
      ]);

      return {
        [params.track.name.original]: {
          deleted: okey,
        },
        [params.track.name.modified]: {
          added: nkey,
        },
      };
    } catch (e) {
      return {
        [params.track.name.original]: {
          error: e.message,
        },
      };
    }
  }

  /**
   * @async
   * @functiom applyAll
   * @description apply changes to all
   * @param {object} params
   * @param {object} data
   */
  async applyAll(params, data) {
    const responses = await Promise.all([
      this.replaceMetadataTrack(params, data),
      this.replaceVttTrack(params, data),
    ]);

    return {
      metadata: responses[0],
      vtt: responses[1],
    };
  }

  /**
   * @async
   * @functiom applyAll
   * @description apply changes partially
   * @param {object} params
   * @param {object} data
   */
  async applyPartial(params, data) {
    const responses = await Promise.all([
      this.processMetadataTrack(params, data),
      this.processVttTrack(params, data),
    ]);
    return {
      metadata: responses[0],
      vtt: responses[1],
    };
  }

  /**
   * @async
   * @functiom onApplyLabel
   * @description determine to apply changes to all or partially
   * @param {object} params
   * @param {object} data
   */
  async onApplyLabel(params, data) {
    return (params.track.applyAll)
      ? this.applyAll(params, data)
      : this.applyPartial(params, data);
  }
}

module.exports = {
  EditLabelOp,
};
