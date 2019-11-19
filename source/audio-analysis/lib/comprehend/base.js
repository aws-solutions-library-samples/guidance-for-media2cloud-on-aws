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
const URL = require('url');
const PATH = require('path');

const {
  Environment,
  CommonUtils,
  StateData,
  Retry,
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
      item = output[this.propList].shift();

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
