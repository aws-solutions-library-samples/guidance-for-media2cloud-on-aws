// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  S3Client,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  StandardRetryStrategy,
} = require('@smithy/util-retry');
const PATH = require('path');
const {
  spawn,
} = require('node:child_process');
const {
  M2CException,
} = require('core-lib');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;
const MAX_ATTEMPTS = 4;

const maxAttemptProvider = async () =>
  MAX_ATTEMPTS;

const retryStrategyOptions = {};

const retryStrategy = new StandardRetryStrategy(
  maxAttemptProvider,
  retryStrategyOptions
);

const PERL = '/opt/bin/perl';
const PERL5LIB = [
  '/opt/lib',
  '/opt/lib/site_perl',
].join(':');

const EXIFTOOL = '/opt/bin/exiftool';
const OPT_EXIF_INFO = [
  '-json',
  '-coordFormat',
  '%d %d %.8f',
];
const OPT_PREVIEW = [
  '-b',
  '-PreviewImage',
];
const OPT_THUMBNAIL = [
  '-b',
  '-ThumbnailImage',
];

const SPAWN_OPTIONS = {
  cwd: undefined,
  env: {
    ...process.env,
    PERL5LIB,
  },
  stdio: [
    'pipe',
    undefined,
    undefined,
  ],
};

async function runCommand(
  bucket,
  key,
  options
) {
  let s3 = new S3Client({
    customUserAgent: CUSTOM_USER_AGENT,
    retryStrategy,
  });

  if (process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined) {
    try {
      const {
        captureAWSv3Client,
      } = require('aws-xray-sdk-core');
      s3 = captureAWSv3Client(s3);
    } catch (e) {
      console.log('aws-xray-sdk-core not loaded');
    }
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
  });

  const s3stream = await s3.send(command)
    .then((res) =>
      res.Body);

  return new Promise((resolve, reject) => {
    const cmdOpts = [
      '-w',
      EXIFTOOL,
      ...options,
      '-',
    ];

    const chunks = [];

    const spawned = spawn(
      PERL,
      cmdOpts,
      SPAWN_OPTIONS
    );

    spawned.on('error', (e) => {
      console.error(
        '[ERR]:',
        'spawn.error:',
        e
      );
      reject(e);
    });

    spawned.on('exit', (code) => {
      console.log(
        '== spawned.exit =='
      );
      if (code !== 0) {
        console.error(
          '[ERR]:',
          'spawn.exit:',
          'code:',
          code
        );
        reject(new M2CException('exiftool returns non-zero'));
        return;
      }

      const buf = Buffer.concat(chunks);
      console.log(
        'spawn.exit:',
        buf.byteLength,
        'bytes processed'
      );

      resolve(buf);
    });

    spawned.stdout.on('data', (chunk) => {
      console.log(
        'spawned.stdout.data:',
        'received:',
        chunk.byteLength
      );
      chunks.push(chunk);
    });

    console.log(
      '== pipe s3stream to stdin =='
    );

    s3stream.pipe(spawned.stdin);
  });
}

async function RunExifTool(
  bucket,
  key
) {
  const info = await runCommand(
    bucket,
    key,
    OPT_EXIF_INFO
  ).then((res) => {
    const parsed = JSON.parse(res)[0];
    /* remove fields that are not related to EXIF */
    Object.keys(parsed)
      .forEach((attr) => {
        if (attr.indexOf('File') === 0
        || attr.indexOf('Directory') === 0) {
          delete parsed[attr];
        }
      });
    /* replace string with boolean flag */
    parsed.PreviewImage = !!parsed.PreviewImage;
    parsed.ThumbnailImage = !!parsed.ThumbnailImage;
    return parsed;
  }).catch((e) => {
    console.error(
      'ERR:',
      'runCommand:',
      'OPT_EXIF_INFO:',
      e
    );
    throw e;
  });

  let preview;
  if (info.PreviewImage) {
    preview = await runCommand(
      bucket,
      key,
      OPT_PREVIEW
    ).catch((e) => {
      console.error(
        'ERR:',
        'runCommand:',
        'OPT_PREVIEW:',
        e
      );
      /* ignore error */
      return undefined;
    });
  }

  let thumbnail;
  if (info.ThumbnailImage) {
    thumbnail = await runCommand(
      bucket,
      key,
      OPT_THUMBNAIL
    ).catch((e) => {
      console.error(
        'ERR:',
        'runCommand:',
        'OPT_THUMBNAIL:',
        e
      );
      /* ignore error */
      return undefined;
    });
  }

  return {
    exif: info,
    preview,
    thumbnail,
  };
}

module.exports = {
  RunExifTool,
};
