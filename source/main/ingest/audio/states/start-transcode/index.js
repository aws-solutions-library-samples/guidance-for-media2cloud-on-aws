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
const FS = require('fs');
const PATH = require('path');
const {
  Environment,
  StateData,
  ServiceToken,
  TranscodeError,
} = require('core-lib');

const CATEGORY = 'transcode';
const API_NAME = 'audio';
const OUTPUT_TYPE_AIML = 'aiml';

class StateStartTranscode {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new TranscodeError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateStartTranscode';
  }

  get stateData() {
    return this.$stateData;
  }

  get uuid() {
    return this.stateData.uuid;
  }

  get input() {
    return this.stateData.input;
  }

  async process() {
    const src = this.stateData.input || {};
    let missing = [
      'bucket',
      'key',
    ].filter(x => src[x] === undefined);
    if (missing.length) {
      throw new TranscodeError(`missing inputs, ${missing.join(', ')}`);
    }
    const dest = src.destination || {};
    missing = [
      'bucket',
      'prefix',
    ].filter(x => dest[x] === undefined);
    if (missing.length) {
      throw new TranscodeError(`missing destination, ${missing.join(', ')}`);
    }
    const data = this.stateData.data || {};
    if (!data.mediainfo) {
      throw new TranscodeError('missing mediainfo');
    }
    const response = await this.createJob();
    /* done with mediainfo, remove mediainfo block to reduce the stateData payload size */
    [
      'video',
      'audio',
      'container',
    ].forEach(x => delete data.mediainfo[x]);

    const output = this.makeOutputPrefix(dest.prefix);
    this.stateData.setStarted();
    this.stateData.setData(CATEGORY, {
      startTime: new Date().getTime(),
      jobId: response.Job.Id,
      output,
    });

    await ServiceToken.register(
      this.stateData.data[CATEGORY].jobId,
      this.stateData.event.token,
      CATEGORY,
      API_NAME,
      this.stateData.toJSON()
    );
    return this.stateData.toJSON();
  }

  async createJob() {
    const template = await this.createJobTemplate();
    const mediaconvert = new AWS.MediaConvert({
      apiVersion: '2017-08-29',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
      endpoint: Environment.MediaConvert.Host,
    });
    return mediaconvert.createJob(template).promise();
  }

  async createJobTemplate() {
    const src = this.stateData.input;
    const outputGroup = this.makeOutputGroup();
    const audioSelectorName = 'Audio Selector 1';
    const template = {
      Role: Environment.MediaConvert.Role,
      Settings: {
        OutputGroups: outputGroup,
        AdAvailOffset: 0,
        Inputs: [
          {
            AudioSelectors: {
              [audioSelectorName]: {
                Tracks: [
                  1,
                ],
                Offset: 0,
                DefaultSelection: 'DEFAULT',
                SelectorType: 'TRACK',
              },
            },
            VideoSelector: {
              ColorSpace: 'FOLLOW',
              Rotate: 'AUTO',
            },
            FilterEnable: 'AUTO',
            PsiControl: 'USE_PSI',
            FilterStrength: 0,
            DeblockFilter: 'DISABLED',
            DenoiseFilter: 'DISABLED',
            TimecodeSource: 'ZEROBASED',
            FileInput: `s3://${src.bucket}/${src.key}`,
          },
        ],
      },
      StatusUpdateInterval: 'SECONDS_12',
      AccelerationSettings: {
        Mode: 'DISABLED',
      },
      UserMetadata: this.makeUserMetadata(),
      BillingTagsSource: 'JOB',
    };
    return template;
  }

  makeOutputGroup() {
    const name = `${OUTPUT_TYPE_AIML}.json`;
    let outputGroup = FS.readFileSync(PATH.join(__dirname, 'tmpl', name));
    outputGroup = JSON.parse(outputGroup.toString());

    const dest = this.stateData.input.destination;
    const bucket = dest.bucket;
    const prefix = this.makeOutputPrefix(dest.prefix, OUTPUT_TYPE_AIML);
    outputGroup.OutputGroupSettings.FileGroupSettings.Destination = `s3://${bucket}/${prefix}`;
    return [outputGroup];
  }

  makeOutputPrefix(prefix, keyword = '') {
    return PATH.join(prefix, CATEGORY, keyword, '/');
  }

  makeUserMetadata() {
    return {
      solutionUuid: Environment.Solution.Metrics.Uuid,
    };
  }
}

module.exports = StateStartTranscode;
