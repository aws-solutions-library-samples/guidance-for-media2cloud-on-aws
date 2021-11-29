// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const PATH = require('path');
const CRYPTO = require('crypto');
const {
  Environment,
  StateData,
  AnalysisError,
  CommonUtils,
  ServiceToken,
} = require('core-lib');

const CATEGORY = 'transcribe';

class StateStartTranscribe {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateStartTranscribe';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const params = await this.makeParams();
    this.stateData.setData(CATEGORY, {
      jobId: params.TranscriptionJobName,
      output: params.OutputKey,
      startTime: new Date().getTime(),
    });
    this.stateData.setStarted();
    /* register token to dynamodb table */
    await ServiceToken.register(
      params.TranscriptionJobName,
      this.stateData.event.token,
      CATEGORY,
      CATEGORY,
      this.stateData.toJSON()
    );
    /* start transcribe */
    await this.retryStartTranscriptionJob(params);
    return this.stateData.toJSON();
  }

  async makeParams() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.input.audio.key;
    if (!bucket || !key) {
      throw new AnalysisError('missing input.destination.bucket and input.audio.key');
    }
    const aiOptions = this.stateData.input.aiOptions;
    const id = this.makeUniqueJobName();
    const outPrefix = this.makeOutputPrefix();
    const modelSettings = (aiOptions.customLanguageModel)
      ? {
        LanguageModelName: aiOptions.customLanguageModel,
      }
      : undefined;
    const settings = {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 10,
    };
    if (aiOptions.customVocabulary !== undefined) {
      settings.VocabularyName = aiOptions.customVocabulary;
    }
    return {
      TranscriptionJobName: id,
      Media: {
        MediaFileUri: undefined,
      },
      JobExecutionSettings: {
        AllowDeferredExecution: true,
        DataAccessRoleArn: Environment.DataAccess.RoleArn,
      },
      MediaFormat: 'mp4',
      OutputBucketName: bucket,
      OutputKey: outPrefix,
      OutputEncryptionKMSKeyId: 'alias/aws/s3',
      IdentifyLanguage: (aiOptions.languageCode === undefined),
      LanguageCode: aiOptions.languageCode,
      Settings: settings,
      ModelSettings: modelSettings,
      Subtitles: {
        Formats: [
          'vtt',
        ],
      },
    };
  }

  makeUniqueJobName() {
    return `${Environment.Solution.Metrics.Uuid}_${this.stateData.uuid}_${CRYPTO.randomBytes(8).toString('hex')}`;
  }

  makeOutputPrefix() {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    let prefix = PATH.join(
      this.stateData.input.destination.prefix,
      'raw',
      timestamp,
      CATEGORY,
      '/'
    );
    if (!(/^[a-zA-Z0-9_.!*'()/-]{1,1024}$/.test(prefix))) {
      prefix = prefix.replace(/[^a-zA-Z0-9_.!*'()/-]/g, '_');
    }
    return prefix;
  }

  async retryStartTranscriptionJob(data) {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.input.audio.key;
    const hostname = [
      (process.env.AWS_REGION === 'us-east-1') ? 's3' : `s3-${process.env.AWS_REGION}`,
      'amazonaws.com',
    ].join('.');
    const attempts = [
      `s3://${bucket}/${key}`,
      // TODO: TO REMOVE!
      `https://${hostname}/${bucket}/${key}`,
      `https://${hostname}/${bucket}/${encodeURIComponent(key)}`,
      `https://${hostname}/${bucket}/${encodeURIComponent(key)}`.replace(/%20/g, '+'),
      `https://${hostname}/${bucket}/${encodeURI(key)}`,
      `https://${hostname}/${bucket}/${encodeURI(key)}`.replace(/%20/g, '+'),
    ];

    const transcribe = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    let response;
    while (attempts.length) {
      const uri = attempts.shift();
      const params = {
        ...data,
        Media: {
          MediaFileUri: uri,
        },
      };
      response = await transcribe.startTranscriptionJob(params).promise().catch(e => e);
      console.log(JSON.stringify(response, null, 2));
      if (!(response instanceof Error)) {
        console.log(`startTranscriptionJob(${this.stateData.uuid}) = ${JSON.stringify(params, null, 2)}`);
        break;
      }
    }
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }
}

module.exports = StateStartTranscribe;
