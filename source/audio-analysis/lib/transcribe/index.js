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
/* eslint-disable no-continue */

const AWS = require('aws-sdk');
const HTTPS = require('https');
const PATH = require('path');
const CRYPTO = require('crypto');

const {
  Environment,
  StateData,
  CommonUtils,
  Retry,
  BaseAnalysis,
  AnalysisError,
  WebVttTrack,
} = require('m2c-core-lib');

const {
  CueLine,
} = require('./cueLine');

/**
 * @class Transcribe
 */
class Transcribe extends BaseAnalysis {
  constructor(stateData) {
    super(Transcribe.Keyword, stateData);

    this.$stateData = stateData;

    this.$instance = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
    });
  }

  static get Keyword() {
    return 'transcribe';
  }

  static get TranscribeStatusMapping() {
    return {
      IN_PROGRESS: StateData.Statuses.InProgress,
      FAILED: StateData.Statuses.Error,
      COMPLETED: StateData.Statuses.Completed,
    };
  }

  static get VocabularyStatusMapping() {
    return {
      PENDING: StateData.Statuses.InProgress,
      READY: StateData.Statuses.Completed,
      FAILED: StateData.Statuses.Error,
    };
  }

  get [Symbol.toStringTag]() {
    return 'Transcribe';
  }

  get stateData() {
    return this.$stateData;
  }

  get instance() {
    return this.$instance;
  }

  /**
   * @function updateVocabulary
   * @description update custom vocabularies to Transcribe service
   */
  async updateVocabulary() {
    const aiOptions = (this.stateData.input || {}).aiOptions;

    if (!(aiOptions.vocabularies || []).length || !aiOptions.customVocabulary) {
      this.stateData.setCompleted();
      return this.stateData.toJSON();
    }

    let response = await Retry.run(this.instance.getVocabulary.bind(this.instance), {
      VocabularyName: aiOptions.customVocabulary,
    }).catch((e) => {
      throw new AnalysisError(`(${aiOptions.customVocabulary}) ${e.message}`);
    });

    if (!(response || {}).DownloadUri) {
      throw new AnalysisError(`(${aiOptions.customVocabulary}) fail to get vocabulary status`);
    }

    const buffer = await this.downloadHTTP(response.DownloadUri);
    let list = buffer.toString().split('\n').filter(x => x).filter(x => x !== 'ENDOFDICTIONARYTRANSCRIBE');
    list = [...new Set(list.concat(aiOptions.vocabularies))];

    response = await Retry.run(this.instance.updateVocabulary.bind(this.instance), {
      VocabularyName: aiOptions.customVocabulary,
      LanguageCode: aiOptions.languageCode,
      Phrases: list,
    }).catch((e) => {
      throw new AnalysisError(`(${aiOptions.customVocabulary}) ${e.message}`);
    });

    if (!(response || {}).VocabularyState) {
      throw new AnalysisError(`(${aiOptions.customVocabulary}) fail to get vocabulary status`);
    }

    const status = Transcribe.VocabularyStatusMapping[response.VocabularyState];
    console.log(`${response.VocabularyState} -> ${status}`);

    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(response.FailureReason);
    }

    return this.stateData.toJSON();
  }

  /**
   * @function checkVocabularyStatus
   * @description  state to check vocabulary update state
   */
  async checkVocabularyStatus() {
    const aiOptions = (this.stateData.input || {}).aiOptions;

    if (!(aiOptions.vocabularies || []).length || !aiOptions.customVocabulary) {
      this.stateData.setCompleted();
      return this.stateData.toJSON();
    }

    const response = await Retry.run(this.instance.getVocabulary.bind(this.instance), {
      VocabularyName: aiOptions.customVocabulary,
    }).catch((e) => {
      throw new AnalysisError(`(${aiOptions.customVocabulary}) ${e.message}`);
    });

    if (!(response || {}).VocabularyState) {
      throw new AnalysisError(`(${aiOptions.customVocabulary}) fail to get vocabulary status`);
    }

    const status = Transcribe.VocabularyStatusMapping[response.VocabularyState];
    console.log(`${response.VocabularyState} -> ${status}`);

    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(response.FailureReason);
    }

    if (status === StateData.Statuses.Completed) {
      this.stateData.setCompleted();
    } else {
      this.stateData.setProgress(this.stateData.progress + 1);
    }

    return this.stateData.toJSON();
  }

  /**
   * @function startJob
   * @description state to start state machine(s) to analyze video, audio, document
   */
  async startJob() {
    const key = ((this.stateData.input || {}).audio || {}).key;
    const aiOptions = (this.stateData.input || {}).aiOptions;

    if (!key) {
      throw new AnalysisError('missing input.audio.key');
    }

    if (!aiOptions) {
      throw new AnalysisError('missing input.aiOptions');
    }

    const name = this.makeUniqueJobName();

    const params = {
      LanguageCode: aiOptions.languageCode || 'en-US',
      Media: {
        MediaFileUri: undefined,
      },
      MediaFormat: 'mp4',
      TranscriptionJobName: name,
    };

    /* optional: set vocabulary */
    if ((await this.useCustomVocabulary(aiOptions.customVocabulary, params.LanguageCode))) {
      params.Settings = {
        VocabularyName: aiOptions.customVocabulary,
      };
    }

    const response = await this.retryStartTranscriptionJob(params);
    const status =
      Transcribe.TranscribeStatusMapping[response.TranscriptionJob.TranscriptionJobStatus];

    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(response.TranscriptionJob.FailureReason);
    }

    this.stateData.setData(Transcribe.Keyword, {
      name,
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function checkJobStatus
   * @description state to check transcribe status
   */
  async checkJobStatus() {
    const name = ((this.stateData.input || {})[Transcribe.Keyword] || {}).name;

    if (!name) {
      throw new AnalysisError(`missing input.${Transcribe.Keyword}.name`);
    }

    const fn = this.instance.getTranscriptionJob.bind(this.instance);

    const response = await Retry.run(fn, {
      TranscriptionJobName: name,
    }).catch((e) => {
      throw new AnalysisError(`(${name}) ${e.message}`);
    });

    if (!(response || {}).TranscriptionJob) {
      throw new AnalysisError(`(${name}) fail to get transcription status`);
    }

    const status =
      Transcribe.TranscribeStatusMapping[response.TranscriptionJob.TranscriptionJobStatus];
    console.log(`${response.TranscriptionJob.TranscriptionJobStatus} -> ${status}`);

    if (status === StateData.Statuses.Error) {
      throw new AnalysisError(response.TranscriptionJob.FailureReason);
    }

    if (status === StateData.Statuses.Completed) {
      this.stateData.setData(Transcribe.Keyword, {
        transcript: response.TranscriptionJob.Transcript.TranscriptFileUri,
        startTime: new Date(response.TranscriptionJob.CreationTime).getTime(),
        endTime: new Date(response.TranscriptionJob.CompletionTime).getTime(),
      });
      this.stateData.setCompleted();
    } else {
      this.stateData.setProgress(this.stateData.progress + 1);
    }

    return this.stateData.toJSON();
  }


  /**
   * @function collectJobResults
   * @description state to download and copy transcripts to s3 bucket
   */
  async collectJobResults(...args) {
    const data = ((this.stateData.input || {})[Transcribe.Keyword] || {});
    const output = await this.copyTranscripts(data.transcript);

    this.stateData.setData(Transcribe.Keyword, {
      name: data.name,
      output,
      startTime: data.startTime,
      endTime: data.endTime,
    }, false);

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function createTrack
   * @description convert JSON result into subtitle track
   */
  async createTrack() {
    const track = new WebVttTrack(WebVttTrack.Constants.UnitInSeconds);
    const data = ((this.stateData.input || {})[Transcribe.Keyword] || {});
    const {
      dir,
      name,
    } = PATH.parse(data.output);

    const json = PATH.join(dir, `${name}.json`);

    let items = await CommonUtils.download(Environment.Proxy.Bucket, json);
    items = JSON.parse(items.toString()).results.items;

    let cueLine = new CueLine();
    while (items.length) {
      const current = items.shift();
      /* case 1: if addItem fails, it means there is a long pause */
      if (!cueLine.addItem(current)) {
        /* look ahead for punctuation */
        if (items[0] && cueLine.addPunctuation(items[0])) {
          items.shift();
        }
        track.addCue(cueLine.begin, cueLine.end, cueLine.cueText);
        cueLine = new CueLine();
        cueLine.addItem(current);
        continue;
      }
      /* case 2: check to see if we should break */
      if (cueLine.shouldBreak()) {
        /* look ahead for punctuation */
        if (items[0] && cueLine.addPunctuation(items[0])) {
          items.shift();
        }
        track.addCue(cueLine.begin, cueLine.end, cueLine.cueText);
        cueLine = new CueLine();
      }
    }

    const vtt = PATH.join(this.makeVttPrefix(), 'output.vtt');

    await CommonUtils.upload({
      Bucket: Environment.Proxy.Bucket,
      Key: vtt,
      ContentType: 'text/vtt',
      ContentDisposition: 'attachment; filename="output.vtt"',
      ServerSideEncryption: 'AES256',
      Body: track.toString(),
    });

    this.stateData.setData(Transcribe.Keyword, {
      vtt,
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function makeUniqueJobName
   * @description helper function to make an unique transcription job name
   */
  makeUniqueJobName() {
    return `${this.stateData.uuid}_${CRYPTO.randomBytes(8).toString('hex')}`;
  }

  /**
   * @function makeMediaFileUri
   * @description helper function to construct https uri based on region
   */
  makeMediaFileUri(bucket, key) {
    const escaped = CommonUtils.escapeS3Characters(key);
    return (process.env.AWS_REGION === 'us-east-1')
      ? `https://s3.amazonaws.com/${bucket}/${escaped}`
      : `https://s3-${process.env.AWS_REGION}.amazonaws.com/${bucket}/${escaped}`;
  }

  /**
   * @function downloadHTTP
   * @description download file using http protocol
   * @param {string} uri - transcription result HTTP URI
   */
  async downloadHTTP(uri) {
    return new Promise((resolve, reject) => {
      const buffers = [];

      const request = HTTPS.request(uri, (response) => {
        response.on('data', chunk =>
          buffers.push(chunk));

        response.on('end', () => {
          if (response.statusCode >= 400) {
            reject(new AnalysisError(`${response.statusCode} ${response.statusMessage} ${uri}`));
            return;
          }
          resolve(Buffer.concat(buffers));
        });
      });

      request.on('error', e =>
        reject(e));

      request.end();
    });
  }

  /**
   * @function copyTranscripts
   * @description copy transcription result to s3 bucket
   * @param {string} uri - transcription result HTTP URI
   */
  async copyTranscripts(uri) {
    const buffer = await this.downloadHTTP(uri);

    const data = JSON.parse(buffer.toString());
    const prefix = this.makeOutputPrefix();

    await Promise.all([
      CommonUtils.upload({
        Bucket: Environment.Proxy.Bucket,
        Key: PATH.join(prefix, 'output.json'),
        ContentType: 'application/json',
        ContentDisposition: 'attachment; filename="output.json"',
        ServerSideEncryption: 'AES256',
        Body: JSON.stringify(data, null, 2),
      }),
      CommonUtils.upload({
        Bucket: Environment.Proxy.Bucket,
        Key: PATH.join(prefix, 'output.txt'),
        ContentType: 'text/plain',
        ContentDisposition: 'attachment; filename="output.txt"',
        ServerSideEncryption: 'AES256',
        Body: data.results.transcripts[0].transcript,
      }),
    ]);

    return PATH.join(prefix, 'output.txt');
  }

  cueText(data) {
    let textClass = 'unsure';
    /* decorate text based on confidence level */
    if (data.confidence > 0.5) {
      textClass = 'five';
    }

    if (data.confidence > 0.6) {
      textClass = 'six';
    }

    if (data.confidence > 0.7) {
      textClass = 'seven';
    }

    if (data.confidence > 0.8) {
      textClass = 'eigth';
    }

    return (data.confidence > 0.9)
      ? ` ${data.content}`
      : ` <c.${textClass}>${data.content}</c>`;
  }

  makeVttPrefix() {
    return PATH.join(
      this.stateData.input.audio.baseDir,
      'vtt',
      Transcribe.Keyword
    );
  }

  makeOutputPrefix() {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.audio.baseDir,
      'raw',
      timestamp,
      Transcribe.Keyword
    );
  }

  async useCustomVocabulary(name, languageCode) {
    const response = await this.instance.getVocabulary({
      VocabularyName: name,
    }).promise().catch(() => undefined);

    /**
     * Use custom vocabulary if and only if
     * * vocabulary exists
     * * language code matches
     * * and vocabulary is ready
     */
    return (response
      && response.LanguageCode === languageCode
      && Transcribe.VocabularyStatusMapping[response.VocabularyState] === StateData.Statuses.Completed); // eslint-disable-line
  }

  /**
   * @async
   * @functiom retryStartTranscriptionJob
   * @description try different scenario to start transcription job
   * * with no uri encode
   * * with uri encode component
   * * with uri encode component and escape s3 space character
   * * with uri encode
   * * with uri encode and escape s3 space character
   * @param {object} payload
   */
  async retryStartTranscriptionJob(payload) {
    const bucket = Environment.Proxy.Bucket;
    const key = ((this.stateData.input || {}).audio || {}).key;

    const hostname = [
      (process.env.AWS_REGION === 'us-east-1') ? 's3' : `s3-${process.env.AWS_REGION}`,
      'amazonaws.com',
    ].join('.');

    const attempts = [
      `https://${hostname}/${bucket}/${key}`,
      `https://${hostname}/${bucket}/${encodeURIComponent(key)}`,
      `https://${hostname}/${bucket}/${encodeURIComponent(key)}`.replace(/%20/g, '+'),
      `https://${hostname}/${bucket}/${encodeURI(key)}`,
      `https://${hostname}/${bucket}/${encodeURI(key)}`.replace(/%20/g, '+'),
    ];

    let response;
    while (attempts.length) {
      const uri = attempts.shift();
      const params = Object.assign({}, payload, {
        Media: {
          MediaFileUri: uri,
        },
      });
      console.log(`${this.stateData.uuid}: startTranscriptionJob = ${JSON.stringify(params, null, 2)}`);
      response = await this.instance.startTranscriptionJob(params).promise().catch(e => e);
      if (!(response instanceof Error)) {
        break;
      }
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  }
}

module.exports = {
  Transcribe,
};
