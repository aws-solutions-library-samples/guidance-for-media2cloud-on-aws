// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  ApiOps,
  AIML,
  Environment,
  CommonUtils,
} = require('core-lib');
const BaseOp = require('./baseOp');

const SUBOP_AIOPTIONS = ApiOps.AIOptionsSettings.split('/').pop();
const DEFAULT_AI_OPTIONS = process.env.ENV_DEFAULT_AI_OPTIONS;
const AI_OPTIONS_S3KEY = process.env.ENV_AI_OPTIONS_S3KEY;
const MIME_JSON = 'application/json';

class SettingsOp extends BaseOp {
  async onPOST() {
    const subop = this.request.pathParameters.uuid;
    if (subop === SUBOP_AIOPTIONS) {
      return super.onPOST(await this.onPostAIOptions());
    }
    throw new Error('SettingsOp.onPOST not impl');
  }

  async onDELETE() {
    const subop = this.request.pathParameters.uuid;
    if (subop === SUBOP_AIOPTIONS) {
      return super.onDELETE(await this.onDeleteAIOptions());
    }
    throw new Error('SettingsOp.onDELETE not impl');
  }

  async onGET() {
    const subop = this.request.pathParameters.uuid;
    if (subop === SUBOP_AIOPTIONS) {
      return super.onGET(await this.onGetAIOptions());
    }
    throw new Error('invalid operation');
  }

  async onGetAIOptions() {
    const aiOptions = {
      ...AIML,
      minConfidence: Environment.Rekognition.MinConfidence,
    };

    /* global options from stored by webapp (admin) */
    const bucket = Environment.Proxy.Bucket;
    const key = AI_OPTIONS_S3KEY;

    const globalOptions = await CommonUtils.download(bucket, key, false)
      .then((res) =>
        JSON.parse(res.Body.toString()))
      .catch(() =>
        undefined);

    if (globalOptions !== undefined) {
      return {
        ...aiOptions,
        ...globalOptions,
      };
    }

    /* environment options during stack creation */
    DEFAULT_AI_OPTIONS.split(',')
      .forEach((x) => {
        aiOptions[x] = true;
      });
    return aiOptions;
  }

  async onPostAIOptions() {
    const aiOptions = this.request.body || {};
    if (Object.keys(aiOptions).length === 0) {
      return undefined;
    }

    const bucket = Environment.Proxy.Bucket;
    const key = AI_OPTIONS_S3KEY;

    return CommonUtils.upload({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(aiOptions),
      ContentType: MIME_JSON,
    }).catch(() =>
      undefined);
  }

  async onDeleteAIOptions() {
    const bucket = Environment.Proxy.Bucket;
    const key = AI_OPTIONS_S3KEY;

    return CommonUtils.deleteObject(bucket, key)
      .catch(() =>
        undefined);
  }
}

module.exports = SettingsOp;
