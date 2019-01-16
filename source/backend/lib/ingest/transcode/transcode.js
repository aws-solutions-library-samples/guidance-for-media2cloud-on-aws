/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const AWS = require('aws-sdk');
const PATH = require('path');

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
 * @class Transcoder
 * @description wrapper of MediaConvert
 */
class Transcoder {
  constructor(config, asset, mediainfo) {
    this.$configuration = config;
    this.$asset = asset;
    this.$mediainfo = mediainfo;
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'Transcoder';
  }
  /* eslint-enable class-methods-use-this */

  get asset() {
    return this.$asset;
  }

  get configuration() {
    return this.$configuration;
  }

  get mediainfo() {
    return this.$mediainfo;
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

  /**
   * @function createChannelMappings
   * @description create audio channel mappings based on mediainfo
   * If there are multiple mono channels in the container (such as MXF),
   * create audio mapping / audioSelectGroup to map mulit-channels into stereo output
   */
  createChannelMappings() {
    const AudioSelectors = {};
    /* if there are multiple mono channels, do channel mappings */
    const {
      audio,
    } = this.mediainfo;

    if (audio.length === 1) {
      const AudioSourceName = 'Audio Selector 1';
      AudioSelectors[AudioSourceName] = {
        Offset: 0,
        DefaultSelection: 'DEFAULT',
        ProgramSelection: 1,
      };
      return { AudioSourceName, AudioSelectors };
    }

    /* create individual audio selection (up to 8) */
    audio.slice(0, 8).forEach((x, idx) => {
      const trackNum = idx + 1;
      const AudioSourceName = `Audio Selector ${trackNum}`;
      AudioSelectors[AudioSourceName] = {
        Tracks: [trackNum],
        Offset: 0,
        DefaultSelection: 'NOT_DEFAULT',
        SelectorType: 'TRACK',
        ProgramSelection: trackNum,
      };
    });

    /* create AudioSelectorGroups */
    const AudioSourceName = 'Audio Selector Group 1';
    const AudioSelectorGroups = {};
    AudioSelectorGroups[AudioSourceName] = {
      AudioSelectorNames: Object.keys(AudioSelectors),
    };
    const InputChannelsL =
      AudioSelectorGroups[AudioSourceName].AudioSelectorNames.reduce((acc, cur, idx) =>
        acc.concat((idx % 2) ? 0 : -60), []);

    const InputChannelsR =
      AudioSelectorGroups[AudioSourceName].AudioSelectorNames.reduce((acc, cur, idx) =>
        acc.concat((idx % 2) ? -60 : 0), []);

    /* create Output RemixSettings */
    const RemixSettings = {
      ChannelMapping: {
        OutputChannels: [
          {
            InputChannels: InputChannelsL,
          },
          {
            InputChannels: InputChannelsR,
          },
        ],
      },
      ChannelsIn: InputChannelsL.length,
      ChannelsOut: 2,
    };

    return {
      AudioSourceName,
      AudioSelectors,
      AudioSelectorGroups,
      RemixSettings,
    };
  }

  /**
   * @function createJobTemplate
   * @description create job data template
   */
  createJobTemplate() {
    const Role = this.configuration.mediaConvertServiceRole;
    const dstBucket = this.configuration.proxyBucket;
    const srcBucket = this.asset.glacier.bucket;
    const srcKey = this.asset.glacier.videoKey;

    /* prepare job template */
    const {
      dir,
      name,
    } = Transcoder.sanitizedPath(srcKey);

    const Destination = `s3://${PATH.join(dstBucket, dir, name)}`;

    const {
      AudioSourceName,
      AudioSelectors,
      AudioSelectorGroups,
      RemixSettings,
    } = this.createChannelMappings();

    const template = {
      Role,
      Settings: {
        OutputGroups: [
          /* video mp4 renditions output group */
          {
            CustomName: 'proxy',
            Name: 'File Group',
            OutputGroupSettings: {
              Type: 'FILE_GROUP_SETTINGS',
              FileGroupSettings: {
                Destination, // from variable
              },
            },
            Outputs: [
              { // 960 x 540
                Extension: 'mp4',
                VideoDescription: {
                  VideoPreprocessors: {
                    Deinterlacer: {
                      Algorithm: 'INTERPOLATE',
                      Mode: 'DEINTERLACE',
                      Control: 'NORMAL',
                    },
                  },
                  ScalingBehavior: 'DEFAULT',
                  TimecodeInsertion: 'DISABLED',
                  AntiAlias: 'ENABLED',
                  Sharpness: 50,
                  CodecSettings: {
                    Codec: 'H_264',
                    H264Settings: {
                      InterlaceMode: 'PROGRESSIVE',
                      NumberReferenceFrames: 3,
                      Syntax: 'DEFAULT',
                      Softness: 0,
                      GopClosedCadence: 1,
                      GopSize: 2,
                      Slices: 1,
                      GopBReference: 'DISABLED',
                      SlowPal: 'DISABLED',
                      SpatialAdaptiveQuantization: 'ENABLED',
                      TemporalAdaptiveQuantization: 'ENABLED',
                      FlickerAdaptiveQuantization: 'DISABLED',
                      EntropyEncoding: 'CABAC',
                      FramerateControl: 'INITIALIZE_FROM_SOURCE',
                      RateControlMode: 'VBR',
                      Bitrate: 1600000,
                      CodecProfile: 'HIGH',
                      Telecine: 'NONE',
                      MinIInterval: 0,
                      AdaptiveQuantization: 'HIGH',
                      CodecLevel: 'AUTO',
                      FieldEncoding: 'PAFF',
                      SceneChangeDetect: 'ENABLED',
                      QualityTuningLevel: 'SINGLE_PASS',
                      FramerateConversionAlgorithm: 'DUPLICATE_DROP',
                      UnregisteredSeiTimecode: 'DISABLED',
                      GopSizeUnits: 'SECONDS',
                      ParControl: 'INITIALIZE_FROM_SOURCE',
                      NumberBFramesBetweenReferenceFrames: 2,
                      RepeatPps: 'DISABLED',
                    },
                  },
                  AfdSignaling: 'NONE',
                  DropFrameTimecode: 'ENABLED',
                  RespondToAfd: 'NONE',
                  ColorMetadata: 'INSERT',
                  Width: 960,
                  Height: 540,
                },
                AudioDescriptions: [
                  {
                    AudioTypeControl: 'FOLLOW_INPUT',
                    AudioSourceName,
                    RemixSettings,
                    CodecSettings: {
                      Codec: 'AAC',
                      AacSettings: {
                        AudioDescriptionBroadcasterMix: 'NORMAL',
                        Bitrate: 96000,
                        RateControlMode: 'CBR',
                        CodecProfile: 'LC',
                        CodingMode: 'CODING_MODE_2_0',
                        RawFormat: 'NONE',
                        SampleRate: 48000,
                        Specification: 'MPEG4',
                      },
                    },
                    LanguageCodeControl: 'FOLLOW_INPUT',
                  },
                ],
                ContainerSettings: {
                  Container: 'MP4',
                  Mp4Settings: {
                    CslgAtom: 'INCLUDE',
                    FreeSpaceBox: 'EXCLUDE',
                    MoovPlacement: 'PROGRESSIVE_DOWNLOAD',
                  },
                },
              },
            ],
          },
          /* thumbnail image output group */
          {
            CustomName: 'thumbnail',
            Name: 'File Group',
            Outputs: [
              {
                Extension: 'jpg',
                ContainerSettings: {
                  Container: 'RAW',
                },
                VideoDescription: {
                  Width: 480,
                  ScalingBehavior: 'DEFAULT',
                  Height: 270,
                  TimecodeInsertion: 'DISABLED',
                  AntiAlias: 'ENABLED',
                  Sharpness: 50,
                  CodecSettings: {
                    Codec: 'FRAME_CAPTURE',
                    FrameCaptureSettings: {
                      FramerateNumerator: 1,
                      FramerateDenominator: 1,
                      MaxCaptures: 10,
                      Quality: 80,
                    },
                  },
                  AfdSignaling: 'NONE',
                  DropFrameTimecode: 'ENABLED',
                  RespondToAfd: 'NONE',
                  ColorMetadata: 'INSERT',
                },
              },
            ],
            OutputGroupSettings: {
              Type: 'FILE_GROUP_SETTINGS',
              FileGroupSettings: {
                Destination,
              },
            },
          },
        ],
        AdAvailOffset: 0,
        Inputs: [
          {
            AudioSelectors,
            AudioSelectorGroups,
            VideoSelector: {
              ColorSpace: 'FOLLOW',
            },
            FilterEnable: 'AUTO',
            PsiControl: 'USE_PSI',
            FilterStrength: 0,
            DeblockFilter: 'DISABLED',
            DenoiseFilter: 'DISABLED',
            TimecodeSource: 'ZEROBASED',
            FileInput: `s3://${srcBucket}/${srcKey}`,
          },
        ],
      },
    };

    /* sanitize JSON data */
    return JSON.parse(JSON.stringify(template));
  }

  /**
   * @function submit
   * @description wrapper function to MediaConvert.createJob api
   * @param {object} template - json job template
   */
  async submit(template) {
    try {
      const endpoint = this.configuration.mediaConvertEndpoint;
      const instance = new AWS.MediaConvert({
        apiVersion: '2017-08-29',
        /* IMPORTANT: the endpoint must be the one from describeEndpoint */
        endpoint,
      });
      const response = await instance.createJob(template).promise();
      return response;
    } catch (e) {
      throw new TranscodeError(`${e.statusCode} ${e.code} ${e.message}`);
    }
  }

  /* eslint-disable no-unused-vars */
  /**
   * @function getJob
   * @description wrapper function to MediaConvert.getJob api
   * @param {string} id - job id
   */
  async getJob(Id) {
    try {
      const endpoint = this.configuration.mediaConvertEndpoint;
      const instance = new AWS.MediaConvert({
        apiVersion: '2017-08-29',
        /* IMPORTANT: the endpoint must be the one from describeEndpoint */
        endpoint,
      });
      const response = await instance.getJob({
        Id,
      }).promise();
      return response;
    } catch (e) {
      throw new TranscodeError(`${e.statusCode} ${e.code} ${e.message}`);
    }
  }
}

module.exports = {
  TranscodeError,
  Transcoder,
};
