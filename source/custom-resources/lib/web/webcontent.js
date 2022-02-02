// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const [
  AWS,
  HTTPS,
] = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return [
      AWSXRay.captureAWS(require('aws-sdk')),
      AWSXRay.captureHTTPs(require('https')),
    ];
  } catch (e) {
    return [
      require('aws-sdk'),
      require('https'),
    ];
  }
})();
const ZIP = require('adm-zip');
const MIME = require('mime');
const mxBaseResponse = require('../shared/mxBaseResponse');

const ExpectedBucketOwner = process.env.ENV_EXPECTED_BUCKET_OWNER;

class WebContent extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);
    /* sanity check */
    const data = event.ResourceProperties.Data;
    this.sanityCheck(data);
    this.$data = data;
    this.$data.packageUrl = new URL(`https://${data.Source.Bucket}.s3.amazonaws.com/${data.Source.Key}`);
  }

  sanityCheck(data) {
    let missing = [
      'SolutionId',
      'Source',
      'Destination',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }
    missing = [
      'Bucket',
      'Key',
    ].filter(x => data.Source[x] === undefined);
    if (missing.length) {
      throw new Error(`missing Source.${missing.join(', ')}`);
    }
    missing = [
      'Bucket',
    ].filter(x => data.Destination[x] === undefined);
    if (missing.length) {
      throw new Error(`missing Destination.${missing.join(', ')}`);
    }
  }

  get data() {
    return this.$data;
  }

  get solutionId() {
    return this.data.SolutionId;
  }

  get source() {
    return this.data.Source;
  }

  get packageUrl() {
    return this.data.packageUrl;
  }

  get destination() {
    return this.data.Destination;
  }

  async downloadHTTP() {
    return new Promise((resolve, reject) => {
      const buffers = [];
      const request = HTTPS.request(this.packageUrl, (response) => {
        response.on('data', chunk => buffers.push(chunk));
        response.on('end', () => {
          if (response.statusCode >= 400) {
            reject(new Error(`${response.statusCode} ${response.statusMessage} ${this.packageUrl.toString()}`));
            return;
          }
          resolve(Buffer.concat(buffers));
        });
      });
      request.on('error', e => reject(e));
      request.end();
    });
  }

  async downloadS3() {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });

    const response = await s3.getObject({
      Bucket: this.source.Bucket,
      Key: this.source.Key,
    }).promise();

    return response.Body;
  }

  async downloadPackage() {
    return this.downloadS3().catch(() =>
      this.downloadHTTP());
  }

  async copyFiles(buffer) {
    const files = [];
    const unzip = new ZIP(buffer);
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    const responses = await Promise.all(unzip.getEntries().filter(x => !x.isDirectory)
      .map((entry) => {
        files.push(entry.entryName);
        return s3.putObject({
          Bucket: this.destination.Bucket,
          Key: entry.entryName,
          ContentType: MIME.getType(entry.entryName),
          ServerSideEncryption: 'AES256',
          Body: unzip.readFile(entry.entryName),
          ExpectedBucketOwner,
        }).promise();
      }));

    if (responses.length !== files.length) {
      throw new Error(`mismatch # of files: ${responses.length}/${files.length}`);
    }
    return files;
  }

  /**
   * @function create
   * @description subscribe a list of emails to SNS topic
   */
  async create() {
    const buffer = await this.downloadPackage();
    const files = await this.copyFiles(buffer);

    this.storeResponseData('Uploaded', files.length);
    this.storeResponseData('LastUpdated', new Date().toISOString());
    this.storeResponseData('Status', 'SUCCESS');

    return this.responseData;
  }

  /**
   * @function purge
   * @description not implememted (not needed)
   */
  async purge() {
    this.storeResponseData('Status', 'SKIPPED');
    return this.responseData;
  }
}

module.exports = WebContent;
