// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const PATH = require('path');
const CRYPTO = require('crypto');
const {
  Environment,
  StateData,
  AnalysisError,
  CommonUtils,
  ServiceToken,
} = require('core-lib');
const {
  BacklogClient: {
    TranscribeBacklogJob,
  },
} = require('service-backlog-lib');

const CATEGORY = 'transcribe';
const JOBNAME_MAXLEN = 200;

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
    const id = params.TranscriptionJobName;

    /* start transcription job */
    const transcribe = new TranscribeBacklogJob();
    await transcribe.startTranscriptionJob(id, params);

    this.stateData.setData(CATEGORY, {
      jobId: params.TranscriptionJobName,
      output: params.OutputKey,
      startTime: new Date().getTime(),
    });
    this.stateData.setStarted();

    /* register token to dynamodb table */
    const stateData = this.stateData.toJSON();
    await ServiceToken.register(
      params.TranscriptionJobName,
      this.stateData.event.token,
      CATEGORY,
      CATEGORY,
      stateData
    );

    return stateData;
  }

  async makeParams() {
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.input.audio.key;
    if (!bucket || !key) {
      throw new AnalysisError('missing input.destination.bucket and input.audio.key');
    }
    const aiOptions = this.stateData.input.aiOptions;
    const id = this.makeUniqueJobName();
    const mediaFileUri = `s3://${PATH.join(bucket, key)}`;
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
        MediaFileUri: mediaFileUri,
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
    /* https://docs.aws.amazon.com/transcribe/latest/APIReference/API_StartTranscriptionJob.html#transcribe-StartTranscriptionJob-request-TranscriptionJobName */
    const solutionUuid = Environment.Solution.Metrics.Uuid;
    const randomId = CRYPTO.randomBytes(4).toString('hex');
    const maxLen = JOBNAME_MAXLEN - solutionUuid.length - randomId.length - 2;
    let name = PATH.parse(this.stateData.input.audio.key).name;
    name = name.replace(/[^0-9a-zA-Z._-]/g, '').slice(0, maxLen);
    return [
      solutionUuid,
      name,
      randomId,
    ].join('_');
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
}

module.exports = StateStartTranscribe;
