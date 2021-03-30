/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const PATH = require('path');
const {
  AIML,
  DB,
  CommonUtils,
  Environment,
  StateData,
  AnalysisTypes,
  AnalysisError,
  ServiceAvailability,
  FrameCaptureMode,
} = require('core-lib');

const TYPE_REKOGNITION_IMAGE = [
  AnalysisTypes.Rekognition.Celeb,
  AnalysisTypes.Rekognition.Face,
  AnalysisTypes.Rekognition.FaceMatch,
  AnalysisTypes.Rekognition.Label,
  AnalysisTypes.Rekognition.Moderation,
  AnalysisTypes.Rekognition.Text,
  AnalysisTypes.Rekognition.CustomLabel,
];
const TYPE_REKOGNITION = [
  ...TYPE_REKOGNITION_IMAGE,
  AnalysisTypes.Rekognition.Person,
  AnalysisTypes.Rekognition.Segment,
];
const TYPE_TRANSCRIBE = [
  AnalysisTypes.Transcribe,
];
const TYPE_COMPREHEND = [
  ...TYPE_TRANSCRIBE,
  AnalysisTypes.Comprehend.Keyphrase,
  AnalysisTypes.Comprehend.Entity,
  AnalysisTypes.Comprehend.Sentiment,
  AnalysisTypes.Comprehend.Topic,
  AnalysisTypes.Comprehend.Classification,
];
const TYPE_TEXTRACT = [
  AnalysisTypes.Textract,
];
const PROJECT_VERSIONS_INVALID_STATUS = [
  'TRAINING_FAILED',
  'FAILED',
  'DELETING',
];
const DISABLE_ANALYSIS = {
  enabled: false,
};

class StatePrepareAnalysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
    this.$defaultAIOptions = {
      ...AIML,
      minConfidence: Environment.Rekognition.MinConfidence,
    };
    process.env.ENV_DEFAULT_AI_OPTIONS.split(',').filter(x => x).forEach((x) => {
      this.$defaultAIOptions[x] = true;
    });
    this.$timestamp = ((this.stateData.input || {}).request || {}).timestamp
      || (new Date()).getTime();
  }

  get [Symbol.toStringTag]() {
    return 'StatePrepareAnalysis';
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

  async process() {
    const uuid = this.stateData.uuid;
    const src = this.stateData.input || {};
    /* #1: fetch from ingest tabe */
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    const fetched = await db.fetch(uuid, undefined, [
      'type',
      'key',
      'aiOptions',
      'proxies',
      'framerate',
      'duration',
      'docinfo',
    ]);
    /* #2: check analysis options */
    const aiOptions = await this.parseAIOptions({
      ...fetched.aiOptions,
      ...src.aiOptions,
    });
    const [
      video,
      audio,
      image,
      document,
    ] = await Promise.all([
      this.prepareVideoAnalysis(fetched, aiOptions),
      this.prepareAudioAnalysis(fetched, aiOptions),
      this.prepareImageAnalysis(fetched, aiOptions),
      this.prepareDocumentAnalysis(fetched, aiOptions),
    ]);
    /* #3: update ingest table */
    const overallStatus = StateData.Statuses.Processing;
    const status = StateData.Statuses.AnalysisStarted;
    await db.update(uuid, undefined, {
      overallStatus,
      status,
      executionArn: this.stateData.event.executionArn,
      aiOptions,
    }, false);
    /* #4: set state data and make sure input.destination is set */
    const destination = {
      bucket: Environment.Proxy.Bucket,
      prefix: CommonUtils.makeSafeOutputPrefix(uuid, fetched.key),
      ...src.destination,
    };
    this.stateData.input = {
      aiOptions,
      destination,
      duration: fetched.duration,
      framerate: fetched.framerate,
      video,
      audio,
      image,
      document,
      request: {
        timestamp: this.timestamp,
      },
      metrics: {
        duration: fetched.duration || 0,
        requestTime: this.timestamp,
        startTime: (new Date()).getTime(),
      },
    };
    this.stateData.setCompleted(status);
    return this.stateData.toJSON();
  }

  async parseAIOptions(requested) {
    const aiOptions = requested || {};
    Object.keys(this.defaultAIOptions).forEach((x) => {
      if (aiOptions[x] === undefined) {
        aiOptions[x] = this.defaultAIOptions[x];
      }
    });
    return this.mergeServiceOptions(aiOptions);
  }

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
      disabled = disabled.concat(TYPE_REKOGNITION);
    } else if (!(await this.checkFacesInCollection(options.faceCollectionId))) {
      disabled.push(AnalysisTypes.Rekognition.FaceMatch);
    }
    if (!transcribe) {
      disabled = disabled.concat(TYPE_TRANSCRIBE);
    }
    if (!comprehend || !transcribe) {
      disabled = disabled.concat(TYPE_COMPREHEND);
    }
    if (!textract) {
      disabled = disabled.concat(TYPE_TEXTRACT);
    }
    let aiOptions = options;
    disabled = Array.from(new Set(disabled));
    disabled.forEach(x => aiOptions[x] = false);
    // check rekognition/transcribe/comprehend custom settings
    if (rekognition) {
      aiOptions = await this.checkRekognitionCustomLabels(aiOptions);
    }
    if (transcribe) {
      aiOptions = await this.checkTranscribeCustomSettings(aiOptions);
    }
    if (comprehend) {
      aiOptions = await this.checkComprehendCustomSettings(aiOptions);
    }
    return aiOptions;
  }

  async checkService(service) {
    const supported = await ServiceAvailability.probe(service).catch(() => false);
    if (!supported) {
      console.log(`checkService: '${service}' not available in '${process.env.AWS_REGION}' region`);
    }
    return supported;
  }

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

  async checkRekognitionCustomLabels(options) {
    /* make sure customlabel and customLabelMidels are set */
    if (!options[AnalysisTypes.Rekognition.CustomLabel] || !options.customLabelModels) {
      return options;
    }
    /* make sure frameCaptureMode was enabled */
    if (Object.values(FrameCaptureMode).indexOf(options.frameCaptureMode) < 0
    || options.frameCaptureMode === FrameCaptureMode.MODE_NONE) {
      options[AnalysisTypes.Rekognition.CustomLabel] = false;
      options.customLabelModels = undefined;
      return options;
    }
    const projectArns = (await Promise.all([].concat(options.customLabelModels).map(x =>
      this.getRunnableProjectVersion(x))))
      .filter(x => x);
    options.customLabelModels = (projectArns.length > 0)
      ? projectArns
      : undefined;
    return options;
  }

  async getRunnableProjectVersion(model) {
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });
    const projectArn = [
      'arn:aws:rekognition',
      process.env.AWS_REGION,
      this.stateData.accountId,
      `project/${model}`,
    ].join(':');
    /* make sure there are runnable project versions */
    return rekog.describeProjectVersions({
      ProjectArn: projectArn,
      MaxResults: 100,
    }).promise()
      .then(data =>
        ((data.ProjectVersionDescriptions.find(x0 =>
          PROJECT_VERSIONS_INVALID_STATUS.find(x1 =>
            x1 === x0.Status) === undefined) !== undefined) ? model : undefined))
      .catch(() => undefined);
  }

  async checkTranscribeCustomSettings(options) {
    return this.checkCustomVocabulary(await this.checkCustomLanguageModel(options));
  }

  async checkCustomLanguageModel(options) {
    if (!options.customLanguageModel) {
      return options;
    }
    const transcribe = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
    });
    const response = await transcribe.describeLanguageModel({
      ModelName: options.customLanguageModel,
    }).promise()
      .then(data => ({
        name: data.LanguageModel.ModelName,
        languageCode: data.LanguageModel.LanguageCode,
        canUse: data.LanguageModel.ModelStatus === 'COMPLETED',
      }))
      .catch(() => undefined);
    /* CLM not ready to use */
    if (!response || !response.canUse) {
      options.customLanguageModel = undefined;
      return options;
    }
    /* incompatible languageCode settings between lanaguageCode & CLM */
    /* languageCode takes priority and disable CLM */
    if (options.languageCode && options.languageCode !== response.languageCode) {
      options.customLanguageModel = undefined;
      return options;
    }
    options.languageCode = response.languageCode;
    return options;
  }

  async checkCustomVocabulary(options) {
    if (!options.customVocabulary) {
      return options;
    }
    const transcribe = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
    });
    const response = await transcribe.getVocabulary({
      VocabularyName: options.customVocabulary,
    }).promise()
      .then(data => ({
        name: data.VocabularyName,
        languageCode: data.LanguageCode,
        canUse: data.VocabularyState === 'READY',
      }))
      .catch(() => undefined);
    /* CV not ready to use */
    if (!response || !response.canUse) {
      options.customVocabulary = undefined;
      return options;
    }
    /* incompatible languageCode settings between lanaguageCode & CV */
    /* languageCode takes priority and disable CV */
    if (options.languageCode && options.languageCode !== response.languageCode) {
      options.customVocabulary = undefined;
      return options;
    }
    options.languageCode = response.languageCode;
    return options;
  }

  async checkComprehendCustomSettings(options) {
    return this.checkCustomEntityRecognizer(options);
  }

  async checkCustomEntityRecognizer(options) {
    if (!options.customEntityRecognizer) {
      return options;
    }
    const arn = [
      'arn:aws:comprehend',
      process.env.AWS_REGION,
      this.stateData.accountId,
      `entity-recognizer/${options.customEntityRecognizer}`,
    ].join(':');
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
    });
    const response = await comprehend.describeEntityRecognizer({
      EntityRecognizerArn: arn,
    }).promise()
      .then(data => ({
        arn: data.EntityRecognizerProperties.EntityRecognizerArn,
        languageCode: data.EntityRecognizerProperties.LanguageCode,
        canUse: data.EntityRecognizerProperties.Status === 'TRAINED'
          || data.EntityRecognizerProperties.Status === 'STOPPED',
      }))
      .catch(() => undefined);
    /* CER not ready to use */
    if (!response || !response.canUse) {
      options.customEntityRecognizer = undefined;
      return options;
    }
    /* incompatible languageCode settings between lanaguageCode & CER */
    /* languageCode takes priority and disable CER */
    if (options.languageCode
      && options.languageCode.slice(0, 2) !== response.languageCode) {
      options.customEntityRecognizer = undefined;
      return options;
    }
    return options;
  }

  async prepareVideoAnalysis(asset, options) {
    /* no video analysis options are enabled */
    if (TYPE_REKOGNITION.find(x => options[x] === true) === undefined) {
      return DISABLE_ANALYSIS;
    }
    const video = (asset.proxies || []).filter(x => x.type === 'video').shift();
    if (!video || !video.key) {
      return DISABLE_ANALYSIS;
    }
    /* make sure video file exists */
    if (!(await CommonUtils.headObject(Environment.Proxy.Bucket, video.key).catch(() => false))) {
      return DISABLE_ANALYSIS;
    }
    return {
      enabled: true,
      key: video.key,
    };
  }

  async prepareAudioAnalysis(asset, options) {
    /* no audio analysis options are enabled */
    if ([
      ...TYPE_TRANSCRIBE,
      ...TYPE_COMPREHEND,
    ].find(x => options[x] === true) === undefined) {
      return DISABLE_ANALYSIS;
    }
    const audio = (asset.proxies || []).filter(x => x.type === 'audio').shift();
    if (!audio || !audio.key) {
      return DISABLE_ANALYSIS;
    }
    /* make sure audio file exists */
    if ((!await CommonUtils.headObject(Environment.Proxy.Bucket, audio.key).catch(() => false))) {
      return DISABLE_ANALYSIS;
    }
    return {
      enabled: true,
      key: audio.key,
    };
  }

  async prepareImageAnalysis(asset, options) {
    if (asset.type !== 'image') {
      return DISABLE_ANALYSIS;
    }
    if (TYPE_REKOGNITION_IMAGE.find(x => options[x] === true) === undefined) {
      return DISABLE_ANALYSIS;
    }
    const proxy = (asset.proxies || []).reduce((acc, cur) =>
      ((acc && acc.fileSize >= cur.fileSize) ? acc : cur), undefined);
    if (!proxy || !proxy.key) {
      return DISABLE_ANALYSIS;
    }
    /* make sure image file exists */
    if (!(await CommonUtils.headObject(Environment.Proxy.Bucket, proxy.key).catch(() => false))) {
      return DISABLE_ANALYSIS;
    }
    return {
      enabled: true,
      key: proxy.key,
    };
  }

  async prepareDocumentAnalysis(asset, options) {
    /* no document analysis options are enabled */
    if (asset.type !== 'document') {
      return DISABLE_ANALYSIS;
    }
    if (TYPE_TEXTRACT.find(x => options[x] === true) === undefined) {
      return DISABLE_ANALYSIS;
    }
    return {
      enabled: true,
      prefix: PATH.parse(asset.proxies[0].key).dir,
      numPages: asset.docinfo.numPages,
    };
  }
}

module.exports = StatePrepareAnalysis;
