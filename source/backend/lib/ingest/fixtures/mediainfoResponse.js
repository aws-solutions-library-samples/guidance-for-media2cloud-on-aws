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
 * @description mock response for MediaInfoCommand
 */
module.exports = {
  filename: 'https://glacier-bucket/location/video.mp4',
  container: {
    format: 'MPEG-4',
    mimeType: 'video/mp4',
    fileSize: 1953014,
    duration: 10000,
    totalBitrate: 519989,
  },
  video: [
    {
      codec: 'AVC',
      profile: 'Main@L3.1',
      bitrate: 389908,
      duration: 10000,
      frameCount: 720,
      width: 1280,
      height: 720,
      framerate: 23.976,
      scanType: 'Progressive',
      aspectRatio: '16:9',
      bitDepth: 8,
      colorSpace: 'YUV 4:2:0',
    },
  ],
  audio: [
    {
      codec: 'AAC',
      bitrate: 125696,
      duration: 10000,
      frameCount: 1294,
      bitrateMode: 'VBR',
      channels: 2,
      samplingRate: 44100,
      samplePerFrame: 1024,
    },
  ],
};
