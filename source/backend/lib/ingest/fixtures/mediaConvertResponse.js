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

/**
 * @description MediaConvert mock job response
 */
const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

module.exports = {
  Job: {
    Arn: `arn:aws:mediaconvert:region:${X.zeroAccountId}:jobs/${X.zeroUUID()}`,
    CreatedAt: new Date().getTime(),
    Id: X.zeroUUID(),
    OutputGroupDetails: [
      {
        OutputDetails: [
          {
            DurationInMs: 30030,
            VideoDetails: {
              HeightInPx: 540,
              WidthInPx: 960,
            },
          },
        ],
      },
      {
        OutputDetails: [
          {
            DurationInMs: 10000,
            VideoDetails: {
              HeightInPx: 270,
              WidthInPx: 480,
            },
          },
        ],
      },
    ],
    Queue: `arn:aws:mediaconvert:region:${X.zeroAccountId()}:queues/Default`,
    Role: `arn:aws:iam::${X.zeroAccountId()}:role/mediaconvert-service-role`,
    Settings: {
      AdAvailOffset: 0,
      Inputs: [
        {
          AudioSelectors: {
            'Audio Selector 1': {
              DefaultSelection: 'DEFAULT',
              Offset: 0,
              ProgramSelection: 1,
            },
          },
          DeblockFilter: 'DISABLED',
          DenoiseFilter: 'DISABLED',
          FileInput: 's3://glacier-bucket/mock/video.mp4',
          FilterEnable: 'AUTO',
          FilterStrength: 0,
          PsiControl: 'USE_PSI',
          TimecodeSource: 'ZEROBASED',
          VideoSelector: {
            ColorSpace: 'FOLLOW',
          },
        },
      ],
      OutputGroups: [
        {
          CustomName: 'proxy',
          Name: 'File Group',
          OutputGroupSettings: {
            FileGroupSettings: {
              Destination: 's3://proxy-bucket/mock/video',
            },
            Type: 'FILE_GROUP_SETTINGS',
          },
          Outputs: [
            {
              AudioDescriptions: [
                {
                  AudioSourceName: 'Audio Selector 1',
                  AudioTypeControl: 'FOLLOW_INPUT',
                  CodecSettings: {
                    AacSettings: {
                      AudioDescriptionBroadcasterMix: 'NORMAL',
                      Bitrate: 96000,
                      CodecProfile: 'LC',
                      CodingMode: 'CODING_MODE_2_0',
                      RateControlMode: 'CBR',
                      RawFormat: 'NONE',
                      SampleRate: 48000,
                      Specification: 'MPEG4',
                    },
                    Codec: 'AAC',
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
              Extension: 'mp4',
              VideoDescription: {
                AfdSignaling: 'NONE',
                AntiAlias: 'ENABLED',
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: {
                    AdaptiveQuantization: 'HIGH',
                    Bitrate: 1600000,
                    CodecLevel: 'AUTO',
                    CodecProfile: 'HIGH',
                    EntropyEncoding: 'CABAC',
                    FieldEncoding: 'PAFF',
                    FlickerAdaptiveQuantization: 'DISABLED',
                    FramerateControl: 'INITIALIZE_FROM_SOURCE',
                    FramerateConversionAlgorithm: 'DUPLICATE_DROP',
                    GopBReference: 'DISABLED',
                    GopClosedCadence: 1,
                    GopSize: 2.0,
                    GopSizeUnits: 'SECONDS',
                    InterlaceMode: 'PROGRESSIVE',
                    MinIInterval: 0,
                    NumberBFramesBetweenReferenceFrames: 2,
                    NumberReferenceFrames: 3,
                    ParControl: 'INITIALIZE_FROM_SOURCE',
                    QualityTuningLevel: 'SINGLE_PASS',
                    RateControlMode: 'VBR',
                    RepeatPps: 'DISABLED',
                    SceneChangeDetect: 'ENABLED',
                    Slices: 1,
                    SlowPal: 'DISABLED',
                    Softness: 0,
                    SpatialAdaptiveQuantization: 'ENABLED',
                    Syntax: 'DEFAULT',
                    Telecine: 'NONE',
                    TemporalAdaptiveQuantization: 'ENABLED',
                    UnregisteredSeiTimecode: 'DISABLED',
                  },
                },
                ColorMetadata: 'INSERT',
                DropFrameTimecode: 'ENABLED',
                Height: 540,
                RespondToAfd: 'NONE',
                ScalingBehavior: 'DEFAULT',
                Sharpness: 50,
                TimecodeInsertion: 'DISABLED',
                VideoPreprocessors: {
                  Deinterlacer: {
                    Algorithm: 'INTERPOLATE',
                    Control: 'NORMAL',
                    Mode: 'DEINTERLACE',
                  },
                },
                Width: 960,
              },
            },
          ],
        },
        {
          CustomName: 'thumbnail',
          Name: 'File Group',
          OutputGroupSettings: {
            FileGroupSettings: {
              Destination: 's3://proxy-bucket/mock/video',
            },
            Type: 'FILE_GROUP_SETTINGS',
          },
          Outputs: [
            {
              ContainerSettings: {
                Container: 'RAW',
              },
              Extension: 'jpg',
              VideoDescription: {
                AfdSignaling: 'NONE',
                AntiAlias: 'ENABLED',
                CodecSettings: {
                  Codec: 'FRAME_CAPTURE',
                  FrameCaptureSettings: {
                    FramerateDenominator: 1,
                    FramerateNumerator: 1,
                    MaxCaptures: 10,
                    Quality: 80,
                  },
                },
                ColorMetadata: 'INSERT',
                DropFrameTimecode: 'ENABLED',
                Height: 270,
                RespondToAfd: 'NONE',
                ScalingBehavior: 'DEFAULT',
                Sharpness: 50,
                TimecodeInsertion: 'DISABLED',
                Width: 480,
              },
            },
          ],
        },
      ],
    },
    Status: 'SUBMITTED',
    UserMetadata: {},
  },
};

