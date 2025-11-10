// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const PATH = require('path');
const CRYPTO = require('crypto');
const {
  Environment,
  StateData,
  AnalysisTypes: {
    Toxicity,
  },
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
    const {
      input: {
        destination: {
          bucket,
        },
        audio: {
          key,
        },
        aiOptions: {
          customLanguageModel,
          customVocabulary,
          languageCode,
          [Toxicity]: _toxicity,
        },
      },
    } = this.stateData;
    if (!bucket || !key) {
      throw new AnalysisError('missing input.destination.bucket and input.audio.key');
    }

    const id = this.makeUniqueJobName();
    const mediaFileUri = `s3://${PATH.join(bucket, key)}`;
    const outPrefix = this.makeOutputPrefix();
    const params = {
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
      // OutputEncryptionKMSKeyId: 'alias/aws/s3',
      IdentifyLanguage: (languageCode === undefined),
      IdentifyMultipleLanguages: (languageCode === undefined),
      LanguageCode: languageCode,
      Settings: {
        // WORKAROUND:
        // Enabling Channel Identification or SpeakerLabels causes
        // Amazon Transcribe to create invalid timestamps of vtt output
        ChannelIdentification: false,
        // ShowSpeakerLabels: true,
        // MaxSpeakerLabels: 10,
      },
      Subtitles: {
        Formats: [
          'vtt',
        ],
      },
    };

    if (customLanguageModel) {
      params.ModelSettings = {
        LanguageModelName: customLanguageModel,
      };
    }

    if (customVocabulary !== undefined) {
      params.Settings.VocabularyName = customVocabulary;
    }

    // Toxicity Detection transcription jobs currently do not support
    // language identification, multi-language identification,
    // channel identification, alternative transcriptions,
    // speaker identification, vocabulary filters,
    // or custom vocabulary use.
    if (_toxicity) {
      params.ToxicityDetection = [
        {
          ToxicityCategories: ['ALL'],
        },
      ];
      params.IdentifyLanguage = false;
      params.IdentifyMultipleLanguages = false;
      params.LanguageCode = 'en-US';
      params.Settings = {
        ChannelIdentification: false,
        ShowAlternatives: false,
        ShowSpeakerLabels: false,
      };
      delete params.LanguageIdSettings;
      delete params.LanguageOptions;
      delete params.ModelSettings;
    }

    return params;
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
