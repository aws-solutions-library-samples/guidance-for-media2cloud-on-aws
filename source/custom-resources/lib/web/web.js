/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const URL = require('url');
const HTTPS = require('https');
const ZIP = require('adm-zip');
const MIME = require('mime');
const CRYPTO = require('crypto');
const AWS = require('aws-sdk');

const {
  AIML,
} = require('m2c-core-lib');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

class WebContent extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    /* sanity check */
    const Props = (event || {}).ResourceProperties || {};
    const missing = WebContent.MandatoryProperties.filter(x => Props[x] === undefined);
    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    this.$solutionId = Props.SolutionId;
    this.$contentBucket = Props.ContentBucket;
    this.$sourceBucket = Props.SourceBucket;
    this.$sourceKey = Props.SourceKey;
    this.$packageUrl = URL.parse(`https://${this.sourceBucket}-${process.env.AWS_REGION}.s3.amazonaws.com/${this.sourceKey}`);
  }

  static get MandatoryProperties() {
    return [
      'ServiceToken',
      'FunctionName',
      'SolutionId',
      'SourceBucket',
      'SourceKey',
      'ContentBucket',
    ];
  }

  get solutionId() {
    return this.$solutionId;
  }

  get sourceBucket() {
    return this.$sourceBucket;
  }

  get sourceKey() {
    return this.$sourceKey;
  }

  get packageUrl() {
    return this.$packageUrl;
  }

  get contentBucket() {
    return this.$contentBucket;
  }

  async downloadHTTP() {
    const promise = new Promise((resolve, reject) => {
      const buffers = [];

      const request = HTTPS.request(this.packageUrl, (response) => {
        response.on('data', chunk =>
          buffers.push(chunk));

        response.on('end', () => {
          if (response.statusCode >= 400) {
            reject(new Error(`${response.statusCode} ${response.statusMessage} ${this.packageUrl.format()}`));
            return;
          }
          resolve(Buffer.concat(buffers));
        });
      });

      request.on('error', e =>
        reject(e));

      request.end();
    });

    return promise;
  }

  async downloadS3() {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const response = await s3.getObject({
      Bucket: this.sourceBucket,
      Key: this.sourceKey,
    }).promise();

    return response.Body;
  }

  async downloadPackage() {
    let response;

    try {
      response = await this.downloadS3();

      process.env.ENV_QUIET || console.log(`Downloaded package via s3://${this.sourceBucket}/${this.sourceKey}`);

      return response;
    } catch (e) {
      process.env.ENV_QUIET || console.log(`Failed to download package via s3://${this.sourceBucket}/${this.sourceKey}. Try HTTP GET ${this.packageUrl.format()}`);

      response = await this.downloadHTTP();

      return response;
    }
  }

  async copyFiles(buffer) {
    const unzip = new ZIP(buffer);
    const files = [];
    const Bucket = this.contentBucket;

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    const promises = unzip.getEntries().filter(x => !x.isDirectory).map((entry) => {
      const Body = unzip.readFile(entry.entryName);

      const params = {
        Bucket,
        Key: entry.entryName,
        ContentType: MIME.getType(entry.entryName),
        ServerSideEncryption: 'AES256',
        Body,
      };

      files.push(entry.entryName);

      return s3.putObject(params).promise();
    });

    console.log(`copyFiles = ${JSON.stringify(files, null, 2)}`);

    const responses = await Promise.all(promises);

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


/**
 * @class SolutionManifest
 * @description create solution-manifest.js file and modify demo.html
 */
class SolutionManifest extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);

    /* sanity check */
    const Props = (event || {}).ResourceProperties || {};
    const missing = SolutionManifest.MandatoryProperties.filter(x =>
      Props[x] === undefined);

    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    this.$props = Props;

    /* default AI options */
    this.$aiml = Object.assign({}, AIML, {
      languageCode: Props.LanguageCode || AIML.languageCode,
      faceCollectionId: Props.FaceCollectionId || AIML.faceCollectionId,
      customVocabulary: Props.CustomVocabulary || AIML.customVocabulary,
      minConfidence: Number.parseInt(Props.MinConfidence || AIML.minConfidence, 10),
    });

    Props.AIOptions.split(',').forEach((x) => {
      this.$aiml[x] = true;
    });
  }

  static get MandatoryProperties() {
    return [
      'ServiceToken',
      'FunctionName',
      'SolutionId',
      'StackName',
      'ContentBucket',
      'CognitoUserPoolId',
      'CognitoAppClientId',
      'CognitoIdentityPoolId',
      'HomePageUrl',
      'IngestStateMachine',
      'AnalysisStateMachine',
      'GroundTruthStateMachine',
      'Media2CloudEndpoint',
      'IotHost',
      'IotTopic',
      'IngestBucket',
      'ProxyBucket',
      'AIOptions',
      'LanguageCode',
      'FaceCollectionId',
      'CustomVocabulary',
      'MinConfidence',
    ];
  }

  static get Constants() {
    return {
      /* auto-generated by CloudFormation template */
      /* install alongside with the main page location */
      ManifestFilename: 'solution-manifest.js',
      ManifestPlaceholder: '<!--SOLUTION_MANIFEST_PLACEHOLDER-->',
      SHA384Placeholder: /<script\s+src="\.\/solution-manifest\.js"\s+integrity="sha384-([^"]+)"><\/script>/,
      IndexHtml: 'demo.html',
    };
  }

  get props() {
    return this.$props;
  }

  get aiml() {
    return this.$aiml;
  }

  /**
   * @function makeManifest
   * @description generate manifest content. These are the parameters that have to be provided
   * for web app to initially connect to the backend.
   */
  makeManifest() {
    const manifest = {
      SolutionId: this.props.SolutionId,
      StackName: this.props.StackName,
      Region: process.env.AWS_REGION,
      Cognito: {
        UserPoolId: this.props.CognitoUserPoolId,
        ClientId: this.props.CognitoAppClientId,
        IdentityPoolId: this.props.CognitoIdentityPoolId,
        RedirectUri: this.props.HomePageUrl,
      },
      StateMachines: {
        Ingest: this.props.IngestStateMachine,
        Analysis: this.props.AnalysisStateMachine,
        GroundTruth: this.props.GroundTruthStateMachine,
      },
      ApiEndpoint: this.props.Media2CloudEndpoint,
      IotHost: this.props.IotHost,
      IotTopic: this.props.IotTopic,
      Ingest: {
        Bucket: this.props.IngestBucket,
      },
      Proxy: {
        Bucket: this.props.ProxyBucket,
      },
      AIML: this.aiml,
    };

    return Buffer.from(`const ${this.props.SolutionId} = ${JSON.stringify(manifest, null, 2)};\n`);
  }

  /**
   * @function copyManifest
   * @description create and install solution-manifest.js
   */
  async copyManifest() {
    const Key = SolutionManifest.Constants.ManifestFilename;

    const manifest = this.makeManifest();
    console.log(manifest.toString());

    const params = {
      Bucket: this.props.ContentBucket,
      Key,
      ContentType: MIME.getType(Key),
      ServerSideEncryption: 'AES256',
      Body: manifest,
    };

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
    });

    let response = await s3.putObject(params).promise();

    /* compute manifest file's integrity checksum */
    /* replace <!--SOLUTION_MANIFEST_PLACEHOLDER--> with actual
       <script src="./solution-manifest.js" integrity="integrity"></script> */
    const sha384 = CRYPTO.createHash('sha384');
    const digest = sha384.update(manifest, 'utf-8').digest('hex');
    const integrity = Buffer.from(digest, 'hex').toString('base64');

    response = await s3.getObject({
      Bucket: this.props.ContentBucket,
      Key: SolutionManifest.Constants.IndexHtml,
    }).promise();

    params.Key =
      SolutionManifest.Constants.IndexHtml;
    params.ContentType =
      MIME.getType(params.Key);

    const matched = response.Body.toString().match(SolutionManifest.Constants.SHA384Placeholder);
    if (!matched) {
      throw new Error('failed to find solution-mainfest');
    }
    params.Body = response.Body.toString().replace(matched[1], integrity);

    response = await s3.putObject(params).promise();

    return response;
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

module.exports = {
  WebContent,
  SolutionManifest,
};
