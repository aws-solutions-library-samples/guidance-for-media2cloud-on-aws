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
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */
/* eslint-disable no-return-assign */
/* eslint-disable no-param-reassign */
const AWS = require('aws-sdk');
const PATH = require('path');
const FS = require('fs');

const {
  Environment,
  StateData,
  CommonUtils,
  Retry,
} = require('m2c-core-lib');

const Outputs = require('../outputs');

/**
 * @class TranscodeError
 */
class TranscodeError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, TranscodeError);
  }
}

/**
 * @class Transcode
 * @description wrapper of MediaConvert
 */
class Transcode {
  constructor(uuid, input) {
    this.$uuid = uuid || CommonUtils.uuid4();
    this.$input = input;
    this.$outputTypes = [
      Outputs.Types.Aiml,
      Outputs.Types.Proxy,
    ];

    this.$instance = new AWS.MediaConvert({
      apiVersion: '2017-08-29',
      endpoint: Environment.MediaConvert.Host,
    });
  }

  static get TranscodeStatusMapping() {
    return {
      SUBMITTED: StateData.Statuses.Started,
      PROGRESSING: StateData.Statuses.InProgress,
      COMPLETE: StateData.Statuses.Completed,
      CANCELED: StateData.Statuses.Error,
      ERROR: StateData.Statuses.Error,
    };
  }

  get [Symbol.toStringTag]() {
    return 'Transcode';
  }

  get uuid() {
    return this.$uuid;
  }

  get input() {
    return this.$input;
  }

  get outputTypes() {
    return this.$outputTypes;
  }

  get instance() {
    return this.$instance;
  }

  /**
   * @function sanitizedPath
   * @description strip off leading forward slash
   * @param {string} path
   */
  static sanitizedPath(path) {
    const {
      root,
      dir,
      base,
      ext,
      name,
    } = PATH.parse(path);

    return {
      root,
      dir: (dir[0] === '/') ? dir.slice(1) : dir,
      base,
      ext,
      name,
    };
  }

  makeUniqueDestination(srcKey) {
    /* prepare job template */
    const {
      dir,
    } = Transcode.sanitizedPath(srcKey);
    return `${PATH.join(this.uuid, dir, 'transcoded')}/`;
  }

  /**
   * @function createChannelMappings
   * @description create audio channel mappings based on mediainfo
   * If there are multiple mono channels in the container (such as MXF),
   * create audio mapping / audioSelectGroup to map mulit-channels into stereo output
   */
  createChannelMappings() {
    const audio = (this.input.mediainfo || {}).audio || [];
    const name = 'Audio Selector 1';
    /* #1: input has no audio */
    /* #2: input has one audio track */
    /* #3: multiple audio tracks and contain stereo track */
    /* #4: multiple audio tracks and contain Dolby E track */
    /* #5: multiple PCM mono audio tracks, take the first 2 mono tracks */
    let tracks = (audio.length === 1)
      ? audio[0]
      : audio.find(x => x.channelS >= 2)
        || audio.find(x => x.format === 'Dolby E')
        || audio.filter(x =>
          x.channelS === 1).sort((a, b) =>
          a.streamIdentifier - b.streamIdentifier).slice(0, 2);

    if (!Array.isArray(tracks)) {
      tracks = [tracks];
    }

    return (!tracks.length)
      ? undefined
      : {
        AudioSourceName: name,
        AudioSelectors: {
          [name]: {
            Offset: 0,
            DefaultSelection: 'DEFAULT',
            SelectorType: 'TRACK',
            /* note: streamIdentifier is 0-based, Track is 1-based */
            Tracks: tracks.map(x => x.streamIdentifier + 1),
          },
        },
      };
  }

  /**
   * @async
   * @function getJobTemplate
   * @description load job template. First, check if user-defined template on s3.
   * If not, use default template under 'tmpl' folder
   * @param {string} ogName - output group name
   * @returns {Object} JSON job template
   */
  async getJobTemplate(ogName) {
    const json = `${ogName}.json`;
    const bucket = Environment.Proxy.Bucket;
    const key = PATH.join(Outputs.Template.Prefix, json);
    const tmpl = await CommonUtils.download(bucket, key).catch(() =>
      FS.readFileSync(PATH.join(__dirname, 'tmpl', json)));

    return JSON.parse(tmpl);
  }

  async makeOutputGroup(ogName, aName) {
    const dst = PATH.join(
      Environment.Proxy.Bucket,
      this.makeUniqueDestination(this.input.key),
      ogName
    );

    const og = await this.getJobTemplate(ogName);
    og.CustomName = ogName;
    og.OutputGroupSettings.FileGroupSettings.Destination = `s3://${dst}/`;
    og.Outputs.forEach((o) => {
      if (!aName) {
        delete o.AudioDescriptions;
      } else if (o.AudioDescriptions) {
        o.AudioDescriptions.forEach(a => a.AudioSourceName = aName);
      }
    });

    /* make sure each output has at least one output stream */
    og.Outputs = og.Outputs.filter(x =>
      x.CaptionDescriptions || x.AudioDescriptions || x.VideoDescription);

    return og;
  }

  async makeProdOutputGroup(outputTypes, aName) {
    return !outputTypes.find(x => x === Outputs.Types.Prod)
      ? undefined
      : this.makeOutputGroup(Outputs.Types.Prod, aName);
  }

  async makeAimlOutputGroup(outputTypes, aName) {
    return !outputTypes.find(x => x === Outputs.Types.Aiml)
      ? undefined
      : this.makeOutputGroup(Outputs.Types.Aiml, aName);
  }

  async makeProxyOutputGroup(outputTypes, aName) {
    return !outputTypes.find(x => x === Outputs.Types.Proxy)
      ? undefined
      : this.makeOutputGroup(Outputs.Types.Proxy, aName);
  }

  /**
   * @function createJobTemplate
   * @description create job data template
   */
  async createJobTemplate(outputTypes = []) {
    const {
      AudioSourceName,
      AudioSelectors,
    } = this.createChannelMappings() || {};

    let ogs = await Promise.all([
      this.makeProdOutputGroup(outputTypes, AudioSourceName),
      this.makeAimlOutputGroup(outputTypes, AudioSourceName),
      this.makeProxyOutputGroup(outputTypes, AudioSourceName),
    ]);
    ogs = ogs.filter(x => x);

    const template = {
      Role: Environment.MediaConvert.Role,
      Settings: {
        OutputGroups: ogs,
        AdAvailOffset: 0,
        Inputs: [
          {
            AudioSelectors,
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
            FileInput: `s3://${this.input.bucket}/${this.input.key}`,
          },
        ],
      },
      StatusUpdateInterval: 'SECONDS_10',
    };

    /* sanitize JSON data */
    return JSON.parse(JSON.stringify(template));
  }

  /**
   * @function submit
   * @description wrapper function to MediaConvert.createJob api
   * @param {object} [tmpl] - json job template
   */
  async submit(tmpl) {
    const missing = [
      'bucket',
      'key',
      'mediainfo',
    ].filter(x => this.input[x] === undefined);

    if (missing.length) {
      throw new TranscodeError(`missing inputs, ${missing.join(', ')}`);
    }

    const template = tmpl || await this.createJobTemplate(this.outputTypes);

    const {
      Job,
    } = await this.instance.createJob(template).promise();

    const status = Transcode.TranscodeStatusMapping[Job.Status];
    if (status === StateData.Statuses.Error) {
      throw new TranscodeError(`(${Job.Id}) ${Job.ErrorMessage || 'unknown error'}`);
    }

    return CommonUtils.neat({
      jobId: Job.Id,
      destination: this.makeUniqueDestination(this.input.key),
      status,
    });
  }

  /**
   * @function getJob
   * @description wrapper function to MediaConvert.getJob api
   * @param {string} [id] - job id
   */
  async getJob(Id) {
    const jobId = Id || (this.input || {}).jobId;

    if (!jobId) {
      throw new TranscodeError('missing jobId');
    }

    const response = await Retry.run(this.instance.getJob.bind(this.instance), {
      Id: jobId,
    }, 20).catch((e) => {
      throw new TranscodeError(`(${jobId}) ${e.message}`);
    });

    if (!(response || {}).Job) {
      throw new TranscodeError(`(${jobId}) fail to get job status`);
    }

    const status = Transcode.TranscodeStatusMapping[response.Job.Status];
    if (status === StateData.Statuses.Error) {
      throw new TranscodeError(`(${jobId}) ${response.Job.ErrorMessage || 'unknown error'}`);
    }

    return CommonUtils.neat({
      jobId: response.Job.Id,
      status,
      percentage: response.Job.JobPercentComplete,
    });
  }
}

module.exports = {
  TranscodeError,
  Transcode,
};
