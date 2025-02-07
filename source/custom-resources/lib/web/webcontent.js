// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const ZIP = require('adm-zip');
const MIME = require('mime');
let https = require('node:https');
const mxBaseResponse = require('../shared/mxBaseResponse');

/* wrapper https in xray sdk */
if (process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined) {
  try {
    const {
      captureHTTPs,
    } = require('aws-xray-sdk-core');
    https = captureHTTPs(require('node:https'));
  } catch (e) {
    console.log('aws-xray-sdk-core not loaded');
  }
}

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;
const EXPECTED_BUCKET_OWNER = process.env.ENV_EXPECTED_BUCKET_OWNER;

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
    /* solution id, source, and destination must exist */
    let missing = [
      'SolutionId',
      'Source',
      'Destination',
    ].filter((x) =>
      data[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing ${missing.join(', ')}`);
    }

    /* source bucket & key must exist */
    missing = [
      'Bucket',
      'Key',
    ].filter((x) =>
      data.Source[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing Source.${missing.join(', ')}`);
    }

    /* destination bucket must exist */
    missing = [
      'Bucket',
    ].filter((x) =>
      data.Destination[x] === undefined);

    if (missing.length) {
      throw new M2CException(`missing Destination.${missing.join(', ')}`);
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

      const request = https.get(this.packageUrl, (response) => {
        response.on('data', (chunk) => {
          buffers.push(chunk);
        });

        response.on('end', () => {
          if (response.statusCode >= 400) {
            reject(new M2CException(`${response.statusCode} ${response.statusMessage} ${this.packageUrl.toString()}`));
            return;
          }
          resolve(Buffer.concat(buffers));
        });
      });

      request.on('error', (e) => {
        reject(e);
      });

      request.end();
    });
  }

  async downloadS3() {
    const s3Client = xraysdkHelper(new S3Client({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new GetObjectCommand({
      Bucket: this.source.Bucket,
      Key: this.source.Key,
    });

    let response = await s3Client.send(command);
    response = await response.Body.transformToByteArray();

    return Buffer.from(response);
  }

  async downloadPackage() {
    return this.downloadS3()
      .catch(() =>
        this.downloadHTTP());
  }

  async copyFiles(buffer) {
    const files = [];
    const unzip = new ZIP(buffer);

    const responses = await Promise.all(unzip.getEntries()
      .filter((x) =>
        !x.isDirectory)
      .map((entry) => {
        files.push(entry.entryName);

        const s3Client = xraysdkHelper(new S3Client({
          customUserAgent: CUSTOM_USER_AGENT,
          retryStrategy: retryStrategyHelper(),
        }));

        const command = new PutObjectCommand({
          Bucket: this.destination.Bucket,
          Key: entry.entryName,
          ContentType: MIME.getType(entry.entryName),
          ServerSideEncryption: 'AES256',
          Body: unzip.readFile(entry.entryName),
          ExpectedBucketOwner: EXPECTED_BUCKET_OWNER,
        });

        return s3Client.send(command);
      }));

    if (responses.length !== files.length) {
      throw new M2CException(`mismatch # of files: ${responses.length}/${files.length}`);
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
