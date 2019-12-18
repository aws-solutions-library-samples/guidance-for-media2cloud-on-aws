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
/* eslint-disable no-plusplus */

const AWS = require('aws-sdk');
const PATH = require('path');

const {
  Environment,
  CommonUtils,
  StateData,
  AnalysisError,
  BaseAnalysis,
} = require('m2c-core-lib');

const {
  Parser,
} = require('../transcribe/parser');

/**
 * @class BaseComprehend
 */
class BaseComprehend extends BaseAnalysis {
  constructor(keyword, stateData) {
    super(keyword, stateData);

    this.$t0 = new Date();

    this.$instance = new AWS.Comprehend({
      apiVersion: '2017-11-27',
    });
  }

  /**
   * @static
   * @property Constants
   * @description constant properties
   */
  static get Constants() {
    return {
      PartSize: {
        UpperBound: 5000,
        LowerBound: 2500,
      },
      MinFileSize: 10,
      SlicesPerProcess: 25,
      Regex: {
        Punctuation: /[\s$\uFFE5^+=`~<>{}[\]|\u3000-\u303F!-#%-\x2A,-/:;\x3F@\x5B-\x5D_\x7B}\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E3B\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]/,
      },
    };
  }

  /**
   * @static
   * @property ServiceType
   * @description comprehend service
   */
  static get ServiceType() {
    return 'comprehend';
  }

  /**
   * @static
   * @property ComprehendStatusMapping
   * @description mapping to Comprehend job result
   */
  static get ComprehendStatusMapping() {
    return {
      SUBMITTED: StateData.Statuses.Started,
      IN_PROGRESS: StateData.Statuses.InProgress,
      COMPLETED: StateData.Statuses.Completed,
      FAILED: StateData.Statuses.Error,
      STOP_REQUESTED: StateData.Statuses.Error,
      STOPPED: StateData.Statuses.Error,
    };
  }

  /**
   * @static
   * @function CleanupItem
   * @description workaround Comprehend result returning leading punctuation character(s)
   * by removing leading and trailing punctuation and space characters.
   * @param {object} item - comprehend result item
   */
  static CleanupItem(item) {
    const modified = {
      ...item,
    };

    while (modified.Text.length) {
      if (!BaseComprehend.Constants.Regex.Punctuation.test(modified.Text.charAt(0))) {
        break;
      }
      modified.BeginOffset += 1;
      modified.Text = modified.Text.slice(1);
    }

    while (modified.Text.length) {
      const end = modified.Text.length - 1;
      if (!BaseComprehend.Constants.Regex.Punctuation.test(modified.Text.charAt(end))) {
        break;
      }
      modified.EndOffset -= 1;
      modified.Text = modified.Text.slice(0, end);
    }

    return modified.Text.length ? modified : undefined;
  }

  get [Symbol.toStringTag]() {
    return 'BaseComprehend';
  }

  /**
   * @property propName
   * @description property name returned from comprehend result payload
   * upper-class should implement this.
   */
  get propName() {
    throw new AnalysisError('propName not impl');
  }

  /**
   * @property propList
   * @description property list name returned from comprehend result payload
   * upper-class should implement this.
   */
  get propList() {
    throw new AnalysisError('propList not impl');
  }

  /**
   * @property t0
   * @description start time of comprehend job
   */
  get t0() {
    return this.$t0;
  }

  /**
   * @property instance
   * @description instance of comprehend service
   */
  get instance() {
    return this.$instance;
  }

  /**
   * @async
   * @function checkJobStatus
   * @description for async operations such as topic and classification.
   * upper-class should implement this method.
   */
  async checkJobStatus(fn) {
    throw new AnalysisError('BaseComprehend.checkJobStatus not impl');
  }

  /**
   * @async
   * @function checkJobStatus
   * @description for async operations such as topic and classification.
   * upper-class should implement this method.
   */
  async collectJobResults(...args) {
    throw new AnalysisError('BaseComprehend.collectJobResults not impl');
  }

  /**
   * @function dataLessThenThreshold
   * @description helper function to set NO_DATA status
   */
  dataLessThenThreshold() {
    this.stateData.setNoData();
    this.stateData.setData(BaseComprehend.ServiceType, {
      [this.keyword]: {
        output: '',
      },
    });
    return this.stateData.toJSON();
  }

  /**
   * @function setJobSucceeded
   * @description helper function to set job completed
   * @param {*} output - output path
   */
  setJobSucceeded(output) {
    this.stateData.setData(BaseComprehend.ServiceType, {
      [this.keyword]: {
        startTime: this.t0.getTime(),
        endTime: new Date().getTime(),
        output,
      },
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function setJobInProgress
   * @description helper function to set job progress
   */
  setJobInProgress() {
    this.stateData.setProgress(this.stateData.progress + 1);
    return this.stateData.toJSON();
  }

  /**
   * @function setTrackSucceeded
   * @description helper function to set timeline track has completed
   * @param {*} output - output path
   */
  setTrackSucceeded(output) {
    const data =
      (this.stateData.input[BaseComprehend.ServiceType] || {})[this.keyword] || {};

    this.stateData.setData(BaseComprehend.ServiceType, {
      [this.keyword]: Object.assign(data, {
        metadata: output,
      }),
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function estimatePartSize
   * @description if string contains multibyte character, use LowerBound partsize
   * @param {string} transcript
   */
  estimatePartSize(transcript) {
    return (Buffer.byteLength(transcript) === transcript.length)
      ? BaseComprehend.Constants.PartSize.UpperBound
      : BaseComprehend.Constants.PartSize.LowerBound;
  }

  /**
   * @function sliceTranscriptResults
   * @description slice transcription into mulit-parts for comprehend batch operations
   * @param {*} transcript - transcription from Transcribe service
   */
  sliceTranscriptResults(transcript) {
    const slices = [];
    const total = transcript.length;
    let read = 0;
    const partSize = this.estimatePartSize(transcript);

    while (read < total) {
      let part = transcript.slice(read, read + partSize);

      if (part.length === partSize) {
        const last = part.lastIndexOf(' ');
        part = part.slice(0, last);
      }

      slices.push({
        begin: read,
        end: read + part.length,
        text: part,
      });

      read += part.length;
    }

    return slices;
  }

  /**
   * @function mergeBatchResults
   * @description merge results from comprehend batch operations and
   * adjust BeginOffset and EndOffset
   * @param {Array} parts - multi-parts configuration
   * @param {Array} results - results from comprehend batch operations
   */
  mergeBatchResults(parts, results) {
    const merged = [];

    let idx = 0;
    while (results.length) {
      const slices = results.splice(0, BaseComprehend.Constants.SlicesPerProcess);
      while (slices.length) {
        const slice = slices.shift();
        const i = idx * BaseComprehend.Constants.SlicesPerProcess;
        while (slice[this.propList].length) {
          const item = slice[this.propList].shift();
          item.BeginOffset += parts[slice.Index + i].begin;
          item.EndOffset += parts[slice.Index + i].begin;
          merged.push(item);
        }
      }
      idx += 1;
    }

    return {
      [this.propList]: merged,
    };
  }

  /**
   * @async
   * @function checkCriteria
   * @description make sure transcription has met the minimum size for
   * comprehend batch operation. Default min. file size is 10 bytes.
   */
  async checkCriteria() {
    const response = await CommonUtils.headObject(
      Environment.Proxy.Bucket,
      this.stateData.input.transcribe.output
    );

    return (response.ContentLength >= BaseComprehend.Constants.MinFileSize);
  }

  /**
   * @async
   * @function uploadResult
   * @description upload results to analysis/raw/{ISO_TIME}/comprehend/{KEYWORD}/
   */
  async uploadResult(result) {
    const prefix = this.makeOutputPrefix();
    const [
      name,
      type,
      body,
    ] = (typeof result === 'string') ? [
      'output.txt',
      'text/plain',
      result,
    ] : [
      'output.json',
      'application/json',
      JSON.stringify(result, null, 2),
    ];

    const output = PATH.join(prefix, name);

    await CommonUtils.upload({
      Bucket: Environment.Proxy.Bucket,
      Key: output,
      Body: body,
      ContentType: type,
      ContentDisposition: `attachment; filename="${name}"`,
      ServerSideEncryption: 'AES256',
    });

    return output;
  }

  /**
   * @async
   * @function startJob
   * @description start batch operation
   */
  async startJob(fn, options) {
    const passed = await this.checkCriteria();
    if (!passed) {
      return this.dataLessThenThreshold();
    }

    const transcript = await CommonUtils.download(
      Environment.Proxy.Bucket,
      this.stateData.input.transcribe.output
    );

    const slices = this.sliceTranscriptResults(transcript);

    const languageCode =
      (this.stateData.input.aiOptions.languageCode || 'en').slice(0, 2);

    let timecodes = [];
    let results = [];
    while (slices.length) {
      const partial = slices.splice(0, BaseComprehend.Constants.SlicesPerProcess);
      const params = CommonUtils.neat(Object.assign({
        LanguageCode: languageCode,
        TextList: partial.map(x => x.text),
      }, options));

      const response = await fn(params).promise();

      if ((response || {}).ResultList) {
        results = results.concat(response.ResultList);
      }

      timecodes = timecodes.concat(partial.map(x => ({
        begin: x.begin,
        end: x.end,
      })));
    }

    if (!results.length) {
      throw new AnalysisError(`fail to process ${BaseComprehend.ServiceType}.${this.keyword}`);
    }

    const response = this.mergeBatchResults(timecodes, results);
    const output = await this.uploadResult(response);

    return this.setJobSucceeded(output);
  }

  /**
   * @async
   * @function uploadMetadataResults
   * @description upload timeline track
   * @param {Array} collection
   */
  async uploadMetadataResults(collection) {
    const output = PATH.join(this.makeMetadataPrefix(), 'output.json');

    await Promise.all([
      CommonUtils.upload({
        Bucket: Environment.Proxy.Bucket,
        Key: output,
        ContentType: 'application/json',
        ContentDisposition: 'attachment; filename="output.json"',
        ServerSideEncryption: 'AES256',
        Body: JSON.stringify(collection, null, 2),
      }),
    ]);

    return output;
  }

  /**
   * @async
   * @function createTrack
   * @description create timeline track by converting Offsets into timecodes
   */
  async createTrack(...args) {
    const [
      transcript,
      output,
    ] = await this.downloadResults();

    const collection = [];
    const parser = new Parser(transcript);
    let item;

    while (output[this.propList].length) {
      item = BaseComprehend.CleanupItem(output[this.propList].shift());
      if (!item) {
        continue; // eslint-disable-line
      }
      const begin = parser.offsetToBeginTime(item.BeginOffset);
      const end = parser.offsetToEndTime(item.EndOffset);

      collection.push({
        text: item.Text,
        type: item.Type,
        confidence: Number.parseFloat(Number(item.Score * 100).toFixed(2)),
        begin: Number.parseInt(begin * 1000, 10),
        end: Number.parseInt(end * 1000, 10),
      });
    }

    const key = await this.uploadMetadataResults(collection);

    return this.setTrackSucceeded(key);
  }

  /**
   * @function makeOutputPrefix
   * @description make output prefix, {PROXY}/analysis/raw/{ISO_TIME}/comprehend/{KEYWORD}/
   */
  makeOutputPrefix() {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.audio.baseDir,
      'raw',
      timestamp,
      BaseComprehend.ServiceType,
      this.keyword
    );
  }

  /**
   * @function makeMetadataPrefix
   * @description make metadata prefix, {PROXY}/analysis/metadata/{KEYWORD}/
   */
  makeMetadataPrefix() {
    return PATH.join(
      this.stateData.input.audio.baseDir,
      'metadata',
      this.keyword
    );
  }

  /**
   * @async
   * @function downloadResults
   * @description download raw json output and transcript files
   */
  async downloadResults() {
    return Promise.all([
      this.downloadJsonTranscript(),
      this.downloadJsonOutput(),
    ]);
  }

  /**
   * @async
   * @function downloadJsonOutput
   * @description download raw json output
   */
  async downloadJsonOutput() {
    const bucket = Environment.Proxy.Bucket;
    const data =
      (this.stateData.input[BaseComprehend.ServiceType] || {})[this.keyword] || {};

    if (!data.output) {
      throw new AnalysisError(`missing input.${BaseComprehend.ServiceType}.${this.keyword}.output`);
    }

    const items = await CommonUtils.download(bucket, data.output);
    return JSON.parse(items.toString());
  }

  /**
   * @async
   * @function downloadJsonTranscript
   * @description download json transcript
   */
  async downloadJsonTranscript() {
    const bucket = Environment.Proxy.Bucket;
    const data = this.stateData.input.transcribe || {};

    if (!data.output) {
      throw new AnalysisError('missing input.transcribe.output');
    }

    const {
      dir,
      name,
    } = PATH.parse(data.output);

    const key = PATH.join(dir, `${name}.json`);
    const items = await CommonUtils.download(bucket, key);

    return JSON.parse(items.toString()).results;
  }
}

module.exports = {
  BaseComprehend,
};
