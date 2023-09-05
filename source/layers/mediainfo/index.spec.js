/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/
const {
  MediaInfoError,
  MediaInfoCommand,
  XBuilder
} = require('mediainfo');
const AWS = require('aws-sdk-mock');
const SDK = require('aws-sdk');
AWS.setSDKInstance(SDK);

const obj = {
  mediaInfo: {
    media: {
      $: {
        ref: 'ref'
      },
      track: [
        {
          $: {
            type: 'General'
          },
          CompleteName: 'track1',
          FileNameExtension: 'ext',
          FileExtension: 'ext'
        }, {
          $: {
            type: 'Audio'
          },
          CompleteName: 'track2',
          FileNameExtension: 'ext',
          FileExtension: 'ext'
        }, {
          $: {
            type: 'NoVideoTest'
          },
          CompleteName: 'track3',
          FileNameExtension: 'ext',
          FileExtension: 'ext'
        }
      ],
      testFlattenNum: [
        '-1',
        '2'
      ],
      testFlattenTrue: [
        'true'
      ],
      testFlattenFalse: [
        'true',
        'false'
      ]
    }
  }
};

const mockXml = (new XBuilder()).buildObject(obj);

jest.mock('child_process', () => {
  return {
    spawnSync: jest.fn(() => {
      return {
        stdout: mockXml,
        status: 0
      };
    })
  };
});

describe('Test MediaInfoError', () => {
  const error = new MediaInfoError();
  expect(error.name).toBe('MediaInfoError');
  expect(error.message).toBe('1900 - unknown mediainfo error');
  expect(error.errorCode).toBe(1900);
});

describe('Test MediaInfoCommand', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
    AWS.mock('S3', 'getSignedUrl', Promise.resolve('url'));
  });

  afterEach(() => {
    AWS.restore('S3');
  });

  test('Test analyze and miniData', async () => {
    const bucketName = 'bucketname';
    const ext = 'mov';
    const key = `folder/file.${ext}`;
    const ref = `s3://${bucketName}/${key}`;

    const mi = new MediaInfoCommand();

    let response = await mi.analyze({
      Bucket: bucketName,
      Key: key
    });

    expect(response.mediaInfo.media.$.ref).toBe(ref);
    expect(response.mediaInfo.media.track[0]['completeName']).toBe(ref);
    expect(response.mediaInfo.media.track[0]['fileNameExtension']).toBe(ext);
    expect(response.mediaInfo.media.track[0]['fileExtension']).toBe(ext);

    const http = `https://www.url.com/path.${ext}`;
    response = await mi.analyze(http);
    expect(response.mediaInfo.media.$.ref).toBe(http);
    expect(response.mediaInfo.media.track[0]['completeName']).toBe(http);
    expect(response.mediaInfo.media.track[0]['fileNameExtension']).toBe(ext);
    expect(response.mediaInfo.media.track[0]['fileExtension']).toBe(ext);

    const path =  './index.js';
    response = await mi.analyze(path);
    expect(response.mediaInfo.media.$.ref).toBe(path);
    expect(response.mediaInfo.media.track[0]['completeName']).toBe(path);
    expect(response.mediaInfo.media.track[0]['fileNameExtension']).toBe('js');
    expect(response.mediaInfo.media.track[0]['fileExtension']).toBe('js');

    expect(response.mediaInfo.media.testFlattenNum).toBe(-1);
    expect(response.mediaInfo.media.testFlattenTrue).toBe(true);
    expect(response.mediaInfo.media.testFlattenFalse).toBe(false);

    response = mi.miniData;
    expect(response.container.length).toBeGreaterThan(0);
    expect(response.audio.length).toBeGreaterThan(0);
    expect(response.video.length).toBe(0);

    response = mi.others;
    expect(response.length).toBe(1);
  });

  test('Test presign', async () => {
    const mi = new MediaInfoCommand();

    await mi.presign().catch(error => {
      expect(error.message).toBe('missing params');
    });

    const fail = 'fail';
    await mi.presign(fail).catch(error => {
      expect(error.message).toBe(`invalid filename '${fail}' not supported`)
    });

    await mi.presign({}).catch(error => {
      expect(error.message).toBe('missing Bucket and Key, {}');
    });
  });
});