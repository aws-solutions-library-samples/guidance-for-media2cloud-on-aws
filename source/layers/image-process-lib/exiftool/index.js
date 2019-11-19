/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const FS = require('fs');
const OS = require('os');
const AWS = require('aws-sdk');
const PATH = require('path');
const CRYPTO = require('crypto');
const CHILD = require('child_process');

const SUFFIX_PREVIEW = '_preview.jpg';
const SUFFIX_THUMBNAIL = '_thumbnail.jpg';

class Exiftool {
  constructor() {
    this.$exit = undefined;
    this.$preview = undefined;
    this.$thumbnail = undefined;

    const root = PATH.join(__dirname, '..');
    /* perl runtime (sandboxed) */
    this.$perl = [
      `LD_LIBRARY_PATH=${root}/amazon/linux2:$LD_LIBRARY_PATH`,
      `PERL5LIB=${root}/t/lib:${root}/t/lib/site_perl`,
      `${root}/t/bin/perl`,
    ].join(' ');

    this.$exiftool = `${root}/t/exiftool/exiftool`;
  }

  // bin/exiftool -b -PreviewImage -w _preview.jpg ~/Downloads/RAW_SONY_R1.SR2
  static get Constants() {
    return {
      CmdOpts: {
        Exif: '-json -coordFormat "%d %d %.8f"',
        Preview: `-b -PreviewImage -w ${SUFFIX_PREVIEW}`,
        Thumbnail: `-b -ThumbnailImage -w ${SUFFIX_THUMBNAIL}`,
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

  get perl() {
    return this.$perl;
  }

  get exiftool() {
    return this.$exiftool;
  }

  async download(bucket, key) {
    return new Promise((resolve, reject) => {
      const tempfile =
        PATH.join(OS.tmpdir(), `${CRYPTO.randomBytes(8).toString('hex')}${PATH.parse(key).ext}`);

      const file = FS.createWriteStream(tempfile);
      file.on('close', () =>
        resolve(tempfile));

      const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
      });

      s3.getObject({
        Bucket: bucket,
        Key: key,
      }).createReadStream().on('error', e =>
        reject(e)).pipe(file);
    });
  }

  async extract(bucket, key) {
    const localfile = await this.download(bucket, key);

    this.exif = await this.getExifInfo(localfile);
    this.preview = await this.getPreviewImage(localfile);
    this.thumbnail = await this.getThumbnailImage(localfile);

    return {
      exif: this.exif,
      preview: this.preview,
      thumbnail: this.thumbnail,
    };
  }

  async getExifInfo(localfile) {
    let exif = await this.command(localfile, Exiftool.Constants.CmdOpts.Exif);
    exif = JSON.parse(exif).shift();

    /* removed fields that are not related to EXIF */
    const removed = [
      'SourceFile',
      'PreviewImage',
      'ThumbnailImage',
    ].concat(Object.keys(exif).filter(x => x.indexOf('File') === 0))
      .concat(Object.keys(exif).filter(x => x.indexOf('Directory') === 0));

    removed.forEach(x =>
      delete exif[x]);

    return exif;
  }

  async checkFileExists(file) {
    return new Promise(resolve =>
      FS.access(file, FS.constants.F_OK, e =>
        resolve(!e)));
  }

  async getPreviewImage(localfile) {
    await this.command(localfile, Exiftool.Constants.CmdOpts.Preview)
      .catch(() => undefined);

    const {
      dir,
      name,
    } = PATH.parse(localfile);
    const preview = PATH.join(dir, `${name}${SUFFIX_PREVIEW}`);

    if (await this.checkFileExists(preview)) {
      return FS.readFileSync(preview);
    }

    return undefined;
  }

  async getThumbnailImage(localfile) {
    await this.command(localfile, Exiftool.Constants.CmdOpts.Thumbnail)
      .catch(() => undefined);

    const {
      dir,
      name,
    } = PATH.parse(localfile);
    const thumbnail = PATH.join(dir, `${name}${SUFFIX_THUMBNAIL}`);

    if (await this.checkFileExists(thumbnail)) {
      return FS.readFileSync(thumbnail);
    }

    return undefined;
  }


  async command(file, cmdOpts) {
    return new Promise((resolve, reject) => {
      const cmd = `${this.perl} ${this.exiftool} ${cmdOpts} ${file}`;
      console.log(cmd);
      CHILD.exec(cmd, (e, stdout, stderr) => {
        if (e || stderr) {
          return reject(e || stderr);
        }
        return resolve(stdout);
      }).once('error', e => reject(e));
    });
  }
}

module.exports = {
  Exiftool,
};
