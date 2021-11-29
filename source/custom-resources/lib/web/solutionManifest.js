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
const MIME = require('mime');
const {
  AIML,
  ApiOps,
  StateData,
  FrameCaptureMode,
  AnalysisTypes,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

const ExpectedBucketOwner = process.env.ENV_EXPECTED_BUCKET_OWNER;

/**
 * @class SolutionManifest
 * @description create solution-manifest.js file and modify demo.html
 */
class SolutionManifest extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    /* sanity check */
    const data = event.ResourceProperties.Data;
    this.sanityCheck(data);
    this.$data = data;
    this.$webBucket = data.Web.Bucket;

    /* make sure UseAccelerateEndpoint is boolean */
    data.S3.UseAccelerateEndpoint = data.S3.UseAccelerateEndpoint === 'true';

    /* parse aiml settings */
    const aiml = {
      ...data.AIML.Detections.reduce((a0, c0) => ({
        ...a0,
        [c0]: true,
      }), AIML),
      minConfidence: Number.parseInt(data.AIML.MinConfidence, 10),
    };

    /* delete unused settings */
    delete data.Web;
    delete data.AIML;

    this.$manifest = {
      ...data,
      AIML: aiml,
      ApiOps,
      Statuses: StateData.Statuses,
      FrameCaptureMode,
      AnalysisTypes,
    };
  }

  sanityCheck(data) {
    let missing = [
      'SolutionId',
      'Version',
      'StackName',
      'Region',
      'LastUpdated',
      'Web',
      'Cognito',
      'S3',
      'StateMachines',
      'ApiEndpoint',
      'IotHost',
      'IotTopic',
      'Ingest',
      'Proxy',
      'AIML',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }
    /* make sure web bucket is defined */
    if (!data.Web.Bucket) {
      throw new Error('missing Web.Bucket');
    }
    /* make sure cognito parameters are defined */
    missing = [
      'UserPoolId',
      'ClientId',
      'IdentityPoolId',
      'RedirectUri',
    ].filter(x => data.Cognito[x] === undefined);
    if (missing.length) {
      throw new Error(`missing Cognito.${missing.join(', ')}`);
    }
    /* make sure s3 transfer acceleration is defined */
    missing = [
      'UseAccelerateEndpoint',
    ].filter(x => data.S3[x] === undefined);
    if (missing.length) {
      throw new Error(`missing S3.${missing.join(', ')}`);
    }
    /* make sure state machine parameters are defined */
    missing = [
      'Ingest',
      'Analysis',
    ].filter(x => data.StateMachines[x] === undefined);
    if (missing.length) {
      throw new Error(`missing StateMachines.${missing.join(', ')}`);
    }
    /* make sure ingest bucket is defined */
    if (!data.Ingest.Bucket) {
      throw new Error('missing Ingest.Bucket');
    }
    /* make sure proxy bucket is defined */
    if (!data.Proxy.Bucket) {
      throw new Error('missing Proxy.Bucket');
    }
    /* make sure aiml is defined */
    missing = [
      'Detections',
      'MinConfidence',
    ].filter(x => data.AIML[x] === undefined);
    if (missing.length) {
      throw new Error(`missing AIML.${missing.join(', ')}`);
    }
  }

  static get Constants() {
    return {
      ManifestFilename: 'solution-manifest.js',
    };
  }

  get data() {
    return this.$data;
  }

  get webBucket() {
    return this.$webBucket;
  }

  get manifest() {
    return this.$manifest;
  }

  /**
   * @function makeManifest
   * @description generate manifest content. These are the parameters that have to be provided
   * for web app to initially connect to the backend.
   */
  makeManifest() {
    return Buffer.from(`const SolutionManifest = ${JSON.stringify(this.manifest, null, 2)};\n\nexport default SolutionManifest;\n`);
  }

  /**
   * @function copyManifest
   * @description create and install solution-manifest.js
   */
  async copyManifest() {
    const key = SolutionManifest.Constants.ManifestFilename;
    const manifest = this.makeManifest();
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      computeChecksums: true,
      signatureVersion: 'v4',
      s3DisableBodySigning: false,
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    return s3.putObject({
      Bucket: this.webBucket,
      Key: key,
      ContentType: MIME.getType(key),
      ServerSideEncryption: 'AES256',
      Body: manifest,
      ExpectedBucketOwner,
    }).promise();
  }

  /**
   * @function create
   * @description subscribe a list of emails to SNS topic
   */
  async create() {
    await this.copyManifest();
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

module.exports = SolutionManifest;
