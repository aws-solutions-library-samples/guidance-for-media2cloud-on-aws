// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  beforeAll,
  describe,
  expect,
} = require('@jest/globals');
const {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
  RestoreObjectCommand,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');

const {
  mockClient,
} = require('aws-sdk-client-mock');
const {
  MediaInfoCommand,
  XBuilder,
} = require('mediainfo');

const obj = {
  mediaInfo: {
    media: {
      $: {
        ref: 'ref',
      },
      track: [
        {
          $: {
            type: 'General',
          },
          CompleteName: 'track1',
          FileNameExtension: 'ext',
          FileExtension: 'ext',
        }, {
          $: {
            type: 'Audio',
          },
          CompleteName: 'track2',
          FileNameExtension: 'ext',
          FileExtension: 'ext',
        }, {
          $: {
            type: 'NoVideoTest',
          },
          CompleteName: 'track3',
          FileNameExtension: 'ext',
          FileExtension: 'ext',
        },
      ],
      testFlattenNum: [
        '-1',
        '2',
      ],
      testFlattenTrue: [
        'true',
      ],
      testFlattenFalse: [
        'true',
        'false',
      ],
    },
  },
};

const mockXml = (new XBuilder()).buildObject(obj);
const s3Mock = mockClient(S3Client);

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(() =>
    'url'),
}));

jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => ({
    stdout: mockXml,
    status: 0,
  })),
}));

describe('Test MediaInfoCommand', () => {
  beforeAll(() => {
    // Mute console.log output for internal functions
    console.log = jest.fn();
    console.error = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    s3Mock.reset();
  });

  afterEach(() => {
  });

  test('Test analyze and miniData', async () => {
    const bucketName = 'bucketname';
    const ext = 'mov';
    const key = `folder/file.${ext}`;
    const ref = `s3://${bucketName}/${key}`;

    const mi = new MediaInfoCommand();

    let response = await mi.analyze({
      Bucket: bucketName,
      Key: key,
    });

    expect(response.mediaInfo.media.$.ref).toBe(ref);
    expect(response.mediaInfo.media.track[0].completeName).toBe(ref);
    expect(response.mediaInfo.media.track[0].fileNameExtension).toBe(ext);
    expect(response.mediaInfo.media.track[0].fileExtension).toBe(ext);

    const http = `https://www.url.com/path.${ext}`;
    response = await mi.analyze(http);
    expect(response.mediaInfo.media.$.ref).toBe(http);
    expect(response.mediaInfo.media.track[0].completeName).toBe(http);
    expect(response.mediaInfo.media.track[0].fileNameExtension).toBe(ext);
    expect(response.mediaInfo.media.track[0].fileExtension).toBe(ext);

    const path = './index.js';
    response = await mi.analyze(path);
    expect(response.mediaInfo.media.$.ref).toBe(path);
    expect(response.mediaInfo.media.track[0].completeName).toBe(path);
    expect(response.mediaInfo.media.track[0].fileNameExtension).toBe('js');
    expect(response.mediaInfo.media.track[0].fileExtension).toBe('js');

    expect(response.mediaInfo.media.testFlattenNum).toBe(-1);
    expect(response.mediaInfo.media.testFlattenTrue).toBe(true);
    expect(response.mediaInfo.media.testFlattenFalse).toBe(false);

    response = mi.miniData;
    expect(response.container.length).toBeGreaterThan(0);
    expect(response.audio.length).toBeGreaterThan(0);
    expect(response.video.length).toBe(0);
  });

  test('Test presign', async () => {
    const mi = new MediaInfoCommand();

    await mi.presign().catch(error => {
      expect(error.message).toBe('missing params');
    });

    const fail = 'fail';
    await mi.presign(fail).catch(error => {
      expect(error.message).toBe(`invalid filename '${fail}' not supported`);
    });

    await mi.presign({}).catch(error => {
      expect(error.message).toBe('missing Bucket and Key, {}');
    });
  });
});
