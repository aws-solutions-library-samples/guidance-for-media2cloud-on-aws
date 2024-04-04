// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ApiOps: {
    AIOptionsSettings = '',
  },
  Environment: {
    Proxy: {
      Bucket: ProxyBucket,
    },
  },
  aimlGetPresets,
  CommonUtils,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const SUBOP_AIOPTIONS = AIOptionsSettings.split('/').pop();
const DEFAULT_AI_OPTIONS = process.env.ENV_DEFAULT_AI_OPTIONS;
const AI_OPTIONS_S3KEY = process.env.ENV_AI_OPTIONS_S3KEY;
const MIME_JSON = 'application/json';

class SettingsOp extends BaseOp {
  async onPOST() {
    const subop = this.request.pathParameters.uuid;
    if (subop === SUBOP_AIOPTIONS) {
      return super.onPOST(await this.onPostAIOptions());
    }
    throw new M2CException('SettingsOp.onPOST not impl');
  }

  async onDELETE() {
    const subop = this.request.pathParameters.uuid;
    if (subop === SUBOP_AIOPTIONS) {
      return super.onDELETE(await this.onDeleteAIOptions());
    }
    throw new M2CException('SettingsOp.onDELETE not impl');
  }

  async onGET() {
    const subop = this.request.pathParameters.uuid;
    if (subop === SUBOP_AIOPTIONS) {
      return super.onGET(await this.onGetAIOptions());
    }
    throw new M2CException('invalid operation');
  }

  async onGetAIOptions() {
    // global options from stored by webapp (admin)
    const bucket = ProxyBucket;
    const key = AI_OPTIONS_S3KEY;

    const globalOptions = await CommonUtils.download(bucket, key)
      .then((res) =>
        JSON.parse(res))
      .catch(() =>
        undefined);

    if (globalOptions !== undefined) {
      return globalOptions;
    }

    // environment options during stack creation
    return aimlGetPresets(DEFAULT_AI_OPTIONS);
  }

  async onPostAIOptions() {
    const bucket = ProxyBucket;
    const key = AI_OPTIONS_S3KEY;

    const aiOptions = this.request.body || {};

    if (Object.keys(aiOptions).length === 0) {
      return undefined;
    }

    return CommonUtils.upload({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(aiOptions),
      ContentType: MIME_JSON,
    }).catch(() =>
      undefined);
  }

  async onDeleteAIOptions() {
    const bucket = ProxyBucket;
    const key = AI_OPTIONS_S3KEY;

    return CommonUtils.deleteObject(bucket, key)
      .catch(() =>
        undefined);
  }
}

module.exports = SettingsOp;
