// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const FS = require('fs');
const PATH = require('path');
const {
  CommonUtils,
  Environment,
  StateData,
  ServiceToken,
  FrameCaptureModeHelper,
  TranscodeError,
} = require('core-lib');
const {
  BacklogClient: {
    MediaConvertBacklogJob,
  },
} = require('service-backlog-lib');

const CATEGORY = 'transcode';
const API_NAME = 'video';
const CUSTOM_TEMPLATE_S3_PREFIX = 'media2cloud/transcode/template';
const OUTPUT_TYPE_AIML = 'aiml';
const OUTPUT_TYPE_PROXY = 'proxy';
const OUTPUT_TYPE_FRAMECAPTURE = 'frameCapture';
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;
const FORMAT_MPEGTS = 'MPEG-TS';
const FRAMECAPTURE_PREFIX = 'frame';

class StateStartTranscode {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new TranscodeError('stateData not StateData object');
    }
    this.$stateData = stateData;
    this.$outputTypes = [
      OUTPUT_TYPE_AIML,
      OUTPUT_TYPE_PROXY,
    ];
  }

  get [Symbol.toStringTag]() {
    return 'StateStartTranscode';
  }

  get stateData() {
    return this.$stateData;
  }

  get outputTypes() {
    return this.$outputTypes;
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

    const params = await this.createJobTemplate();
    /* done with mediainfo, remove mediainfo block to reduce the stateData payload size */
    [
      'video',
      'audio',
      'container',
    ].forEach(x =>
      delete this.stateData.data.mediainfo[x]);

    const stateOutput = await this.createJob(params);

    const output = this.makeOutputPrefix(dest.prefix);
    this.stateData.setStarted();
    this.stateData.setData(CATEGORY, {
      ...stateOutput,
      output,
    });

    const id = stateOutput.backlogId;
    const responseData = this.stateData.toJSON();
    await ServiceToken.register(
      id,
      this.stateData.event.token,
      CATEGORY,
      API_NAME,
      responseData
    );

    return responseData;
  }

  async createJob(params) {
    /* use backlog system */
    const uniqueId = CommonUtils.uuid4();

    const backlog = new MediaConvertBacklogJob();
    return backlog.createJob(uniqueId, params)
      .then(() => ({
        startTime: new Date().getTime(),
        backlogId: uniqueId,
      }));
  }

  async createJobTemplate() {
    const src = this.stateData.input;
    const {
      AudioSourceName,
      AudioSelectors,
    } = this.createChannelMappings() || {};

    const ogs = await Promise.all(this.outputTypes.map(outputType =>
      this.makeOutputGroup(outputType, AudioSourceName)));

    const frameCaptureGroup = await this.useFrameCapture();
    if (frameCaptureGroup !== undefined) {
      ogs.push(frameCaptureGroup);
    }

    const template = {
      Role: Environment.DataAccess.RoleArn,
      Settings: {
        OutputGroups: ogs.filter(x => x),
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
            FileInput: `s3://${src.bucket}/${src.key}`,
          },
        ],
      },
      StatusUpdateInterval: 'SECONDS_12',
      AccelerationSettings: {
        Mode: this.useAcceleration() ? 'PREFERRED' : 'DISABLED',
      },
      UserMetadata: this.makeUserMetadata(),
      Queue: await this.useQueue(),
      BillingTagsSource: 'JOB',
    };
    /* sanitize JSON data */
    return JSON.parse(JSON.stringify(template));
  }

  createChannelMappings() {
    return (((this.stateData.data.mediainfo.container || [])[0] || {}).format === FORMAT_MPEGTS)
      ? this.createChannelMappingsMpegTs()
      : this.createChannelMappingsGeneric();
  }

  createChannelMappingsMpegTs() {
    const audio = this.stateData.data.mediainfo.audio || [];
    const name = 'Audio Selector 1';
    const pids = this.parsePIDs(audio);
    return (!pids.length)
      ? undefined
      : {
        AudioSourceName: name,
        AudioSelectors: {
          [name]: {
            Offset: 0,
            DefaultSelection: 'DEFAULT',
            SelectorType: 'PID',
            Pids: pids,
          },
        },
      };
  }

  parsePIDs(audio) {
    /* #1: input has no audio */
    if (!audio.length) {
      return [];
    }
    /* #2: input has one audio track */
    if (audio.length === 1) {
      return [audio[0].iD];
    }
    /* #3: multiple audio tracks and contain stereo track */
    for (let track of audio) {
      if (this.getChannels(track) >= 2) {
        return [track.iD];
      }
    }
    /* #4: multiple audio tracks and contain Dolby E track */
    for (let track of audio) {
      if (track.format === 'Dolby E') {
        return [track.iD];
      }
    }
    /* #5: multiple PCM mono audio tracks, take the first 2 mono tracks */
    let pcms = audio.filter(x => this.getChannels(x) === 1);
    pcms = pcms.sort((a, b) => a.iD - b.iD)
      .map(x => x.iD)
      .slice(0, 2);
    return pcms;
  }

  createChannelMappingsGeneric() {
    const audio = this.stateData.data.mediainfo.audio || [];
    const name = 'Audio Selector 1';
    const tracks = this.parseTracks(audio);
    return (!tracks.length)
      ? undefined
      : {
        AudioSourceName: name,
        AudioSelectors: {
          [name]: {
            Offset: 0,
            DefaultSelection: 'DEFAULT',
            SelectorType: 'TRACK',
            Tracks: tracks,
          },
        },
      };
  }

  parseTracks(audio) {
    /* #0: reorder audio tracks */
    const reordered = audio.sort((a, b) => {
      const a0 = (a.streamIdentifier !== undefined) ? a.streamIdentifier : a.streamOrder;
      const b0 = (b.streamIdentifier !== undefined) ? b.streamIdentifier : b.streamOrder;
      return a0 - b0;
    }).map((x, idx) => ({
      ...x,
      trackIdx: idx + 1,
    }));
    /* #1: input has no audio */
    if (!reordered.length) {
      return [];
    }
    /* #2: input has one audio track */
    if (reordered.length === 1) {
      return [reordered[0].trackIdx];
    }
    /* #3: multiple audio tracks and contain stereo track */
    for (let track of reordered) {
      if (this.getChannels(track) >= 2) {
        return [track.trackIdx];
      }
    }
    /* #4: multiple audio tracks and contain Dolby E track */
    for (let track of reordered) {
      if (track.format === 'Dolby E') {
        return [track.trackIdx];
      }
    }
    /* #5: multiple PCM mono audio tracks, take the first 2 mono tracks */
    const pcms = reordered.filter(x => this.getChannels(x) === 1);
    return pcms.slice(0, 2).map(x => x.trackIdx);
  }

  getChannels(track) {
    return (track.channelS !== undefined)
      ? track.channelS
      : track.channels;
  }

  async makeOutputGroup(ogName, aName) {
    const dest = this.stateData.input.destination;
    const bucket = dest.bucket;
    const prefix = this.makeOutputPrefix(dest.prefix, ogName);
    const og = await this.getJobTemplate(ogName);
    og.CustomName = ogName;
    og.OutputGroupSettings.FileGroupSettings.Destination = `s3://${bucket}/${prefix}`;
    og.Outputs.forEach((o) => {
      if (!aName) {
        delete o.AudioDescriptions;
      } else if (o.AudioDescriptions) {
        o.AudioDescriptions.forEach(a => {
          a.AudioSourceName = aName;
        });
      }
    });
    /* compute output WxH */
    const outputs = og.Outputs.filter(o =>
      o.VideoDescription !== undefined
      && (o.VideoDescription.Width === 0 || o.VideoDescription.Height === 0));
    if (outputs.length > 0) {
      const [
        width,
        height,
      ] = this.downscaleOutput();
      for (let output of outputs) {
        output.VideoDescription.Width = width;
        output.VideoDescription.Height = height;
      }
    }
    /* make sure each output has at least one output stream */
    og.Outputs = og.Outputs.filter(x =>
      x.CaptionDescriptions || x.AudioDescriptions || x.VideoDescription);
    return og;
  }

  makeOutputPrefix(prefix, keyword = '') {
    return PATH.join(prefix, CATEGORY, keyword, '/');
  }

  async getJobTemplate(ogName) {
    const dest = this.stateData.input.destination;
    const bucket = dest.bucket;
    const json = `${ogName}.json`;
    const key = PATH.join(CUSTOM_TEMPLATE_S3_PREFIX, json);
    const tmpl = await CommonUtils.download(bucket, key).catch(() =>
      FS.readFileSync(PATH.join(__dirname, 'tmpl', json)));
    return JSON.parse(tmpl);
  }

  useAcceleration() {
    const {
      data: {
        mediainfo = {},
      },
      input: {
        options = {},
      },
    } = this.stateData;
    const disabled = options.useAcceleration === false;
    const useQueue = options.jobQueue;
    const video = (mediainfo.video || [])[0];
    let duration = this.stateData.input.duration || 0;
    duration = Math.floor(duration);
    return (!disabled && !useQueue && video && duration > 5 * 60 * 1000);
  }

  makeUserMetadata() {
    return {
      solutionUuid: Environment.Solution.Metrics.Uuid,
    };
  }

  async useQueue() {
    const queue = (this.stateData.input.options || {}).jobQueue;
    if (!queue) {
      return undefined;
    }
    const mediaconvert = (new MediaConvertBacklogJob())
      .getMediaConvertInstance();
    const response = await mediaconvert.getQueue({
      Name: queue,
    }).promise()
      .catch(() =>
        undefined);
    return ((response || {}).Queue || {}).Arn;
  }

  downscaleOutput() {
    const video = (this.stateData.data.mediainfo.video || [])[0];
    if (!video) {
      return [
        DEFAULT_WIDTH,
        DEFAULT_HEIGHT,
      ];
    }
    if (video.width <= DEFAULT_WIDTH && video.height <= DEFAULT_HEIGHT) {
      return [
        ((video.width >> 1) << 1),
        ((video.height >> 1) << 1),
      ];
    }
    let scaleW = 1;
    let scaleH = 1;
    if (video.width > DEFAULT_WIDTH) {
      scaleW = DEFAULT_WIDTH / video.width;
    }
    if (video.height > DEFAULT_HEIGHT) {
      scaleH = DEFAULT_HEIGHT / video.height;
    }
    const scale = Math.min(scaleH, scaleW);
    return [
      (Math.round(video.width * scale) >> 1) << 1,
      (Math.round(video.height * scale) >> 1) << 1,
    ];
  }

  async useFrameCapture() {
    const framerate = this.stateData.input.framerate;
    const frameCaptureMode = (this.stateData.input.aiOptions || {}).frameCaptureMode;
    const [
      numerator,
      denominator,
    ] = FrameCaptureModeHelper.suggestFrameCaptureRate(framerate, frameCaptureMode);
    if (!numerator || !denominator) {
      return undefined;
    }
    const outputGroup = await this.makeOutputGroup(OUTPUT_TYPE_FRAMECAPTURE);
    outputGroup.OutputGroupSettings.FileGroupSettings.Destination += `${FRAMECAPTURE_PREFIX}`;
    /* update FrameCaptureSettings */
    const codecSettings = outputGroup.Outputs[0].VideoDescription.CodecSettings;
    codecSettings.FrameCaptureSettings.FramerateNumerator = numerator;
    codecSettings.FrameCaptureSettings.FramerateDenominator = denominator;
    return outputGroup;
  }
}

module.exports = StateStartTranscode;
