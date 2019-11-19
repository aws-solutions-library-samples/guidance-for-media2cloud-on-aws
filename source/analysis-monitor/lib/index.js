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
const AWS = require('aws-sdk');
const PATH = require('path');

const {
  AIML,
  Environment,
  StateData,
  DB,
  CommonUtils,
  ServiceAvailability,
  SNS,
  AnalysisError,
} = require('m2c-core-lib');

/**
 * @class Analysis
 */
class Analysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }

    this.$stateData = stateData;

    /* TODO: categorize detections? */
    /* default AI options */
    this.$defaultAIOptions = Object.assign({}, AIML, {
      languageCode: Environment.Transcribe.LanguageCode,
      faceCollectionId: Environment.Rekognition.CollectionId,
      customVocabulary: Environment.Transcribe.CustomVocabulary,
      minConfidence: Environment.Rekognition.MinConfidence,
    });

    process.env.ENV_DEFAULT_AI_OPTIONS.split(',').filter(x => x).forEach((x) => {
      this.$defaultAIOptions[x] = true;
    });

    /* generate timestamp */
    this.$timestamp = ((this.stateData.input || {}).request || {}).timestamp
      || (new Date()).getTime();
  }

  static get StepStatusMapping() {
    return {
      RUNNING: StateData.Statuses.InProgress,
      SUCCEEDED: StateData.Statuses.Completed,
      FAILED: StateData.Statuses.Error,
      TIMED_OUT: StateData.Statuses.Error,
      ABORTED: StateData.Statuses.Error,
    };
  }

  static get Constants() {
    return {
      SupportedAnalysis: [
        'video',
        'audio',
        'image',
        'document',
      ],
    };
  }

  get [Symbol.toStringTag]() {
    return 'Analysis';
  }

  get stateData() {
    return this.$stateData;
  }

  get defaultAIOptions() {
    return this.$defaultAIOptions;
  }

  get timestamp() {
    return this.$timestamp;
  }

  /**
   * @function startAnalysis
   * @description state to start state machine(s) to analyze video, audio, document
   */
  async startAnalysis() {
    const input = await (new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    })).fetch(this.stateData.uuid, undefined, [
      'proxies',
      'key',
      'type',
    ]);

    /* check analysis options */
    const aiOptions = await this.parseAIOptions();

    const responses = await Promise.all([
      this.startVideoAnalysis(input, aiOptions),
      this.startAudioAnalysis(input, aiOptions),
      this.startImageAnalysis(input, aiOptions),
      this.startDocumentAnalysis(input, aiOptions),
    ]);

    this.stateData.setData('video', {
      arn: (responses[0] || {}).executionArn,
      status: responses[0] ? StateData.Statuses.Started : StateData.Statuses.NotStarted,
    });

    this.stateData.setData('audio', {
      arn: (responses[1] || {}).executionArn,
      status: responses[1] ? StateData.Statuses.Started : StateData.Statuses.NotStarted,
    });

    this.stateData.setData('image', {
      arn: (responses[2] || {}).executionArn,
      status: responses[2] ? StateData.Statuses.Started : StateData.Statuses.NotStarted,
    });

    this.stateData.setData('document', {
      arn: (responses[3] || {}).executionArn,
      status: responses[3] ? StateData.Statuses.Started : StateData.Statuses.NotStarted,
    });

    const container = (((input.mediainfo || {}).file || {}).track || []).find(x =>
      x.$.type.toLowerCase() === 'general');

    this.stateData.setData('metrics', {
      duration: (container || {}).duration || 1000,
      requestTime: this.timestamp,
      startTime: (new Date()).getTime(),
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function checkAnalysisStatus
   * @description state to check analysis status
   */
  async checkAnalysisStatus() {
    try {
      const responses = await Promise.all(Analysis.Constants.SupportedAnalysis.map(key =>
        this.executionCompleted(key)));

      if (responses[0] && responses[1] && responses[2] && responses[3]) {
        this.stateData.setCompleted();
      } else {
        this.stateData.setProgress(this.computeProgress());
      }

      return this.stateData.toJSON();
    } catch (e) {
      console.log(`checkAnalysisStatus: ${e.message}`);

      /* cancel all other analysis state machines if one of them has failed */
      await this.cancelAnalysis(e).catch(e0 =>
        console.log(`cancelAnalysis: ${e0.message}`));

      throw e;
    }
  }

  /**
   * @function collectAnalysisResults
   * @description state to start processing results state machine
   */
  async collectAnalysisResults() {
    let analysis = Analysis.Constants.SupportedAnalysis.filter(x =>
      this.stateData.input[x].status !== StateData.Statuses.NotStarted);

    const responses = (await Promise.all(analysis.map(key =>
      this.collectResultByType(key)))).filter(x => x);

    const params = {
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    };

    await Promise.all(responses.map((response) => {
      const key = Object.keys(response).shift();
      this.stateData.setData(key, response[key]);
      return (new DB(params)).update(this.stateData.uuid, key, response[key]);
    }));

    /* update ingest table */
    const ingest = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });

    const data = await ingest.fetch(this.stateData.uuid);
    analysis = Array.from(new Set(analysis.concat(data.analysis || [])));
    await ingest.update(this.stateData.uuid, undefined, Object.assign(data, {
      analysis,
    }), false);

    this.stateData.setData('metrics', {
      endTime: (new Date()).getTime(),
    });

    this.stateData.setCompleted();

    return this.stateData.toJSON();
  }

  /**
   * @function onCompleted
   * @description send notification
   */
  async onCompleted() {
    return SNS.send(`analysis: ${this.stateData.uuid}`, this.stateData.toJSON()).catch(() => false);
  }

  /**
   * @function cancelAnalysis
   * @description stop other analysis process if encounters error.
   */
  async cancelAnalysis(error) {
    return Promise.all(Analysis.Constants.SupportedAnalysis.map((key) => {
      const data = this.stateData.input[key];

      if (data.status === StateData.Statuses.NotStarted) {
        return undefined;
      }

      const step = new AWS.StepFunctions({
        apiVersion: '2016-11-23',
      });

      return step.stopExecution({
        executionArn: data.arn,
        error: 'AnalysisError',
        cause: `canceled by analysis-monitor due to ${error.message}`,
      }).promise().catch(e => e.message);
    }));
  }

  /**
   * @function parseAIOptions
   * @description ensure AI options are set properly before starting analysis state machine(s)
   */
  async parseAIOptions() {
    const aiOptions = (this.stateData.input || {}).aiOptions || {};
    Object.keys(this.defaultAIOptions).forEach((x) => {
      if (aiOptions[x] === undefined) {
        aiOptions[x] = this.defaultAIOptions[x];
      }
    });
    return this.mergeServiceOptions(aiOptions);
  }

  /**
   * @function checkComprehendLanguageCode
   * @description check to see if requested language is supported by Comprehend
   * @param {string} languageCode
   */
  checkComprehendLanguageCode(languageCode) {
    /* check language code availability */
    return [
      'en',
      'es',
      'fr',
      'de',
      'it',
      'pt',
    ].indexOf(languageCode.slice(0, 2)) >= 0;
  }

  /**
   * @async
   * @function checkFacesInCollection
   * @description check if collection exists and there are faces indexed.
   * @param {string} collectionId
   */
  async checkFacesInCollection(collectionId) {
    if (!collectionId) {
      return undefined;
    }

    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });

    return rekog.listFaces({
      CollectionId: collectionId,
      MaxResults: 2,
    }).promise().catch(() => undefined).then(data => data.Faces.length);
  }

  /**
   * @async
   * @function mergeServiceOptions
   * @description merge options that are regionally supported by the services
   * by checking the service availability.
   * @param {Object} options - aiml options
   */
  async mergeServiceOptions(options) {
    /* checking service availability to enable/disable aiml option */
    const [
      rekognition,
      comprehend,
      transcribe,
      textract,
    ] = await Promise.all([
      'rekognition',
      'comprehend',
      'transcribe',
      'textract',
    ].map(x => this.checkService(x)));

    let disabled = [];
    if (!rekognition) {
      disabled = disabled.concat([
        'celeb',
        'face',
        'faceMatch',
        'label',
        'moderation',
        'person',
        'text',
      ]);
    } else if (!(await this.checkFacesInCollection(options.faceCollectionId))) {
      disabled.push('faceMatch');
    }
    if (!transcribe) {
      disabled = disabled.concat([
        'transcript',
        'entity',
        'keyphrase',
        'sentiment',
        'topic',
        'classification',
      ]);
    }
    if (!comprehend || !this.checkComprehendLanguageCode(options.languageCode)) {
      disabled = disabled.concat([
        'entity',
        'keyphrase',
        'sentiment',
        'topic',
        'classification',
      ]);
    }
    if (!textract) {
      disabled = disabled.concat([
        'document',
      ]);
    }

    disabled = Array.from(new Set(disabled));

    const aiOptions = Object.assign({}, options);
    // eslint-disable-next-line
    disabled.forEach(x => aiOptions[x] = false);
    return aiOptions;
  }

  /**
   * @function startVideoAnalysis
   * @description start video analysis sub-state machine
   * @param {object} asset - asset loaded from DB
   * @param {object} options - ai options
   */
  async startVideoAnalysis(asset, options) {
    /* no video analysis options are enabled */
    if (!(options.label || options.celeb || options.face
      || options.faceMatch || options.person || options.moderation)) {
      return undefined;
    }

    const video = (asset.proxies || []).filter(x => x.type === 'video').shift();
    if (!video || !video.key) {
      return undefined;
    }

    /* make sure video file exists */
    try {
      await CommonUtils.headObject(Environment.Proxy.Bucket, video.key);
    } catch (e) {
      return undefined;
    }

    return this.startExecution(Environment.StateMachines.VideoAnalysis, {
      uuid: this.stateData.uuid,
      input: {
        video: {
          key: video.key,
          baseDir: this.makeAnalysisOutputPath(asset.key),
        },
        aiOptions: options,
      },
    });
  }

  /**
   * @function startAudioAnalysis
   * @description start audio analysis sub-state machine
   * @param {object} asset - asset loaded from DB
   * @param {object} options - ai options
   */
  async startAudioAnalysis(asset, options) {
    /* no audio analysis options are enabled */
    if (!(options.transcript || options.entity || options.phrase
      || options.sentiment || options.topic || options.classification)) {
      return undefined;
    }

    const audio = (asset.proxies || []).filter(x => x.type === 'audio').shift();
    if (!audio || !audio.key) {
      return undefined;
    }

    /* make sure audio file exists */
    try {
      await CommonUtils.headObject(Environment.Proxy.Bucket, audio.key);
    } catch (e) {
      return undefined;
    }

    return this.startExecution(Environment.StateMachines.AudioAnalysis, {
      uuid: this.stateData.uuid,
      input: {
        audio: {
          key: audio.key,
          baseDir: this.makeAnalysisOutputPath(asset.key),
        },
        aiOptions: options,
      },
    });
  }

  /**
   * @function startImageAnalysis
   * @description start image analysis sub-state machine
   * @param {object} asset - asset loaded from DB
   * @param {object} options - ai options
   */
  async startImageAnalysis(asset, options) {
    if (asset.type !== 'image') {
      return undefined;
    }

    /* no video analysis options are enabled */
    if (!(options.label || options.celeb || options.face
      || options.faceMatch || options.text || options.moderation)) {
      return undefined;
    }

    const proxy = (asset.proxies || []).reduce((acc, cur) =>
      ((acc && acc.fileSize >= cur.fileSize) ? acc : cur), undefined);
    if (!proxy || !proxy.key) {
      return undefined;
    }

    /* make sure image file exists */
    try {
      await CommonUtils.headObject(Environment.Proxy.Bucket, proxy.key);
    } catch (e) {
      return undefined;
    }

    return this.startExecution(Environment.StateMachines.ImageAnalysis, {
      uuid: this.stateData.uuid,
      input: {
        image: {
          key: proxy.key,
          baseDir: this.makeAnalysisOutputPath(asset.key),
        },
        aiOptions: options,
      },
    });
  }

  /**
   * @function startDocumentAnalysis
   * @description start document analysis sub-state machine
   * @param {object} asset - asset loaded from DB
   * @param {object} options - ai options
   */
  async startDocumentAnalysis(asset, options) {
    /* no document analysis options are enabled */
    if (!options.document) {
      return undefined;
    }

    if (asset.type !== 'pdf') {
      return undefined;
    }

    /* make sure document file exists */
    try {
      await CommonUtils.headObject(Environment.Ingest.Bucket, asset.key);
    } catch (e) {
      return undefined;
    }

    return this.startExecution(Environment.StateMachines.DocumentAnalysis, {
      uuid: this.stateData.uuid,
      input: {
        document: {
          key: asset.key,
          baseDir: this.makeAnalysisOutputPath(asset.key),
        },
        aiOptions: options,
      },
    });
  }

  /**
   * @function makeStateMachineArn
   * @description helper function to construct state machine arn
   * @param {string} stateMachine - state machine name
   */
  makeStateMachineArn(stateMachine) {
    return `arn:aws:states:${process.env.AWS_REGION}:${this.stateData.accountId}:stateMachine:${stateMachine}`;
  }

  makeAnalysisOutputPath(key) {
    return PATH.join(
      this.stateData.uuid,
      PATH.parse(key).dir,
      'analysis'
    );
  }

  /**
   * @function startExecution
   * @description start state machine execution
   * @param {string} stateMachine - state machine arn
   * @param {object} input - input to the state machine
   */
  async startExecution(stateMachine, input) {
    const data = Object.assign({}, input);
    data.input = Object.assign({}, input.input, {
      request: {
        timestamp: this.timestamp,
      },
    });
    console.log(`${stateMachine}: ${JSON.stringify(data, null, 2)}`);

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    return step.startExecution({
      stateMachineArn: this.makeStateMachineArn(stateMachine),
      input: JSON.stringify(data),
    }).promise();
  }

  /**
   * @async
   * @function describeExecution
   * @description wrapper function to step functions describe execution
   */
  async describeExecution(arn) {
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    return step.describeExecution({
      executionArn: arn,
    }).promise();
  }

  /**
   * @async
   * @function getExecutionError
   * @description get sub-state execution error message
   * @param {string} arn - executionArn
   * @returns {string} errorMessage
   */
  async getExecutionError(arn) {
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    let response;
    let failed;
    do {
      response = await step.getExecutionHistory({
        executionArn: arn,
        maxResults: 100,
        reverseOrder: true,
        nextToken: (response || {}).nextToken,
      }).promise().catch(e => undefined);

      failed = response.events.filter(x => ([
        'Failed',
        'Aborted',
        'TimeOut',
      ].findIndex(x0 => x.type.indexOf(x0) >= 0) >= 0));
    } while ((response || {}).nextToken && !failed);

    let message;
    while (failed.length) {
      const task = failed.shift();
      if ((task.lambdaFunctionFailedEventDetails || {}).cause) {
        return task.lambdaFunctionFailedEventDetails.cause;
      }

      if ((task.lambdaFunctionTimedOutEventDetails || {}).cause) {
        return task.lambdaFunctionTimedOutEventDetails.cause;
      }

      if ((task.executionFailedEventDetails || {}).cause) {
        return task.executionFailedEventDetails.cause;
      }

      if ((task.taskTimedOutEventDetails || {}).cause) {
        return task.taskTimedOutEventDetails.cause;
      }

      if ((task.executionAbortedEventDetails || {}).cause) {
        return task.executionAbortedEventDetails.cause;
      }
      message = `${arn} ${task.type}`;
    }
    return message;
  }

  /**
   * @function executionCompleted
   * @description check state machine execution status
   * @param {string} key - stateData.input, 'video', 'audio', or 'document'
   */
  async executionCompleted(key) {
    const data = this.stateData.input[key];

    if (data.status === StateData.Statuses.NotStarted) {
      return true;
    }

    let {
      status,
    } = await this.describeExecution(data.arn);

    status = Analysis.StepStatusMapping[status];

    this.stateData.setData(key, {
      status,
    });

    if (status === StateData.Statuses.Error) {
      const error = await this.getExecutionError(data.arn).catch(() => undefined);
      throw new AnalysisError(error || `${data.arn} failed`);
    }

    if (status === StateData.Statuses.Completed) {
      return true;
    }

    return false;
  }

  /**
   * @function computeProgress
   * @description helper function to estimate current progress based on media duration
   */
  computeProgress() {
    const metrics = this.stateData.input.metrics;
    const diff = (new Date()).getTime() - Number.parseInt(metrics.startTime, 10);

    /* assume analysis takes 4X of the duration */
    return Math.min(Math.floor((diff / (metrics.duration * 4)) * 100), 99);
  }

  /**
   * @function parseResultByType
   * @param {string} key - 'video', 'audio', or 'document'
   * @param {Array} outputs - an array of responses from sub-state machine
   */
  parseResultByType(key, outputs) {
    let result;
    switch (key) {
      case 'video':
        result = this.parseVideoResult(outputs);
        break;
      case 'audio':
        result = this.parseAudioResult(outputs);
        break;
      case 'image':
        result = this.parseImageResult(outputs);
        break;
      case 'document':
        result = this.parseDocumentResult(outputs);
        break;
      default:
        break;
    }
    return result;
  }

  /**
   * @function parseErrorResult
   * @param {Array} outputs - array of sub-state responses
   */
  parseErrorResult(outputs) {
    const errors = outputs.filter(x =>
      x.status === StateData.Statuses.Error).map(e =>
      `${e.operation || e.state || 'unknown'}: ${e.errorMessage || 'unknown error'}`);

    return errors.length ? errors : undefined;
  }

  /**
   * @function parseVideoResult
   * @description parse video analysis results
   * @param {Array} outputs
   */
  parseVideoResult(outputs) {
    let completed = outputs.filter(x =>
      x.status === StateData.Statuses.Completed);

    completed = completed.reduce((acc, cur) =>
      Object.assign(acc, cur.next.rekognition), {});

    const errors = this.parseErrorResult(outputs);

    return {
      rekognition: completed,
      errors,
    };
  }

  /**
   * @function parseAudioResult
   * @description parse audio analysis results
   * @param {Array} outputs
   */
  parseAudioResult(outputs) {
    let completed = outputs.filter(x =>
      x.status === StateData.Statuses.Completed);

    const transcribe = completed.reduce((acc, cur) =>
      Object.assign(acc, cur.next.transcribe), {});

    completed = completed.reduce((acc, cur) =>
      Object.assign(acc, cur.next.comprehend), {});

    const errors = this.parseErrorResult(outputs);

    return {
      comprehend: completed,
      transcribe,
      errors,
    };
  }

  /**
   * @function parseImageResult
   * @description parse video analysis results
   * @param {*} output
   */
  parseImageResult(output) {
    const keyword = 'rekog-image';
    return (output.status === StateData.Statuses.Completed)
      ? {
        [keyword]: output.next[keyword],
      } : undefined;
  }

  /**
   * @function parseDocumentResult
   * @description parse document analysis results
   * @param {Array} outputs
   */
  parseDocumentResult(outputs) {
    let completed = outputs.filter(x =>
      x.status === StateData.Statuses.Completed);

    completed = completed.reduce((acc, cur) =>
      Object.assign(acc, cur.next.texttract), {});

    const errors = this.parseErrorResult(outputs);

    return {
      texttract: completed,
      errors,
    };
  }

  /**
   * @function collectResultByType
   * @description collect result by type
   * @param {string} key - 'video', 'audio', or 'document'
   */
  async collectResultByType(key) {
    const data = this.stateData.input[key];

    if (data.status === StateData.Statuses.NotStarted) {
      return undefined;
    }

    const response = await this.describeExecution(data.arn);

    const result = Object.assign({
      arn: response.executionArn.split(':').pop(),
      status: Analysis.StepStatusMapping[response.status],
      startTime: new Date(response.startDate).getTime(),
      endTime: new Date(response.stopDate).getTime(),
    }, this.parseResultByType(key, JSON.parse(response.output)));

    return {
      [key]: result,
    };
  }

  /**
   * @async
   * @function checkService
   * @description wrapper to probe service support for current region.
   * @param {string} service
   */
  async checkService(service) {
    const supported = await ServiceAvailability.probe(service).catch(() => false);
    if (!supported) {
      console.log(`checkService: '${service}' not available in '${process.env.AWS_REGION}' region`);
    }
    return supported;
  }
}

module.exports = {
  Analysis,
};
