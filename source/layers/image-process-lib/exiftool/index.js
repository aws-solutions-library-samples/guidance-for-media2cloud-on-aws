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
const PATH = require('path');
const CHILD = require('child_process');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;

class Exiftool {
  constructor() {
    this.$exif = undefined;
    this.$preview = undefined;
    this.$thumbnail = undefined;
  }

  static GetConfiguration() {
    const base = PATH.join(__dirname, '..');
    return {
      LD_LIBRARY_PATH: PATH.join(base, 'amazon/linux2'),
      EXIFTOOL: PATH.join(base, 't/exiftool/exiftool'),
      PERL5LIB: [
        PATH.join(base, 't/lib'),
        PATH.join(base, 't/lib/site_perl'),
      ].join(':'),
      PERL: PATH.join(base, 't/bin/perl'),
    };
  }

  static get Constants() {
    return {
      CmdOpts: {
        Exif: [
          '-json',
          '-coordFormat',
          '%d %d %.8f',
        ],
        Preview: [
          '-b',
          '-PreviewImage',
        ],
        Thumbnail: [
          '-b',
          '-ThumbnailImage',
        ],
      },
    };
  }

  get exif() {
    return this.$exif;
  }

  set exif(val) {
    this.$exif = val;
  }

  get preview() {
    return this.$preview;
  }

  set preview(val) {
    this.$preview = val;
  }

  get thumbnail() {
    return this.$thumbnail;
  }

  set thumbnail(val) {
    this.$thumbnail = val;
  }

  async extract(bucket, key) {
    this.exif = await this.getExifInfo(bucket, key);
    if (this.exif.PreviewImage) {
      this.preview = await this.getPreviewImage(bucket, key);
    }
    if (this.exif.ThumbnailImage) {
      this.thumbnail = await this.getThumbnailImage(bucket, key);
    }
    return {
      exif: this.exif,
      preview: this.preview,
      thumbnail: this.thumbnail,
    };
  }

  async getExifInfo(bucket, key) {
    let exif = await this.command(bucket, key, Exiftool.Constants.CmdOpts.Exif);
    exif = JSON.parse(exif).shift();
    /* removed fields that are not related to EXIF */
    const removed = Object.keys(exif).filter(x =>
      x.indexOf('File') === 0 || x.indexOf('Directory') === 0);
    removed.forEach((x) => {
      delete exif[x];
    });
    /* replace with boolean flag */
    exif.PreviewImage = !!exif.PreviewImage;
    exif.ThumbnailImage = !!exif.ThumbnailImage;
    return exif;
  }

  async getPreviewImage(bucket, key) {
    return this.command(bucket, key, Exiftool.Constants.CmdOpts.Preview)
      .catch(() => undefined);
  }

  async getThumbnailImage(bucket, key) {
    return this.command(bucket, key, Exiftool.Constants.CmdOpts.Thumbnail)
      .catch(() => undefined);
  }

  async command(bucket, key, options) {
    return new Promise((resolve, reject) => {
      const config = Exiftool.GetConfiguration();
      const ldLibraryPath = [
        config.LD_LIBRARY_PATH,
        process.env.LD_LIBRARY_PATH,
      ].filter(x => x).join(':');

      const defaults = {
        cwd: undefined,
        env: {
          ...process.env,
          LD_LIBRARY_PATH: ldLibraryPath,
          PERL5LIB: config.PERL5LIB,
        },
        stdio: [
          'pipe',
          undefined,
          undefined,
        ],
      };

      const params = [
        '-w',
        config.EXIFTOOL,
        ...options,
        '-',
      ];

      const chunks = [];
      const spawned = CHILD.spawn(config.PERL, params, defaults);
      spawned.on('error', e =>
        reject(e));
      spawned.on('exit', code => (
        (code !== 0)
          ? reject(new Error(`exiftool failed with exit code ${code}`))
          : resolve(Buffer.concat(chunks))));
      spawned.stdout.on('data', chunk =>
        chunks.push(chunk));

      const readStream = this.getS3ReadStream(bucket, key);
      readStream.on('error', e =>
        reject(e));
      readStream.pipe(spawned.stdio[0]);
    });
  }

  getS3ReadStream(bucket, key) {
    return (new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: CUSTOM_USER_AGENT,
    })).getObject({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
    }).createReadStream();
  }
}

module.exports = Exiftool;
