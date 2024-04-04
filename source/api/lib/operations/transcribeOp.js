// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  TranscribeClient,
  ListLanguageModelsCommand,
  ListVocabulariesCommand,
} = require('@aws-sdk/client-transcribe');
const {
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const OP_CUSTOMVOCABULARIES = 'custom-vocabularies';
const OP_CUSTOMLANGUAGEMODELS = 'custom-language-models';
const STATUS_COMPLETED = 'COMPLETED';
const STATUS_READY = 'READY';
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class TranscribeOp extends BaseOp {
  async onPOST() {
    throw new M2CException('invalid operation');
  }

  async onDELETE() {
    throw new M2CException('invalid operation');
  }

  async onGET() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_CUSTOMLANGUAGEMODELS) {
      return super.onGET(await this.onGetCustomLanguageModels());
    }
    if (op === OP_CUSTOMVOCABULARIES) {
      return super.onGET(await this.onGetCustomVocabularies());
    }
    throw new M2CException('invalid operation');
  }

  async onGetCustomLanguageModels() {
    let command;
    let response;
    let customLanguageModels = [];

    do {
      const transcribeClient = xraysdkHelper(new TranscribeClient({
        customUserAgent: CUSTOM_USER_AGENT,
        retryStrategy: retryStrategyHelper(),
      }));

      command = new ListLanguageModelsCommand({
        StatusEquals: STATUS_COMPLETED,
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      });

      response = await transcribeClient.send(command)
        .catch(() =>
          undefined);

      if (response && response.Models.length) {
        const models = response.Models
          .map((x) => ({
            name: x.ModelName,
            languageCode: x.LanguageCode,
            canUse: true,
          }));
        customLanguageModels = customLanguageModels.concat(models);
      }
    } while ((response || {}).NextToken);

    return customLanguageModels;
  }

  async onGetCustomVocabularies() {
    let command;
    let response;
    let customVocabularies = [];
    do {
      const transcribeClient = xraysdkHelper(new TranscribeClient({
        customUserAgent: CUSTOM_USER_AGENT,
        retryStrategy: retryStrategyHelper(),
      }));

      command = new ListVocabulariesCommand({
        StateEquals: STATUS_READY,
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      });

      response = await transcribeClient.send(command)
        .catch(() =>
          undefined);

      if (response && response.Vocabularies.length) {
        const vocabulary = response.Vocabularies
          .map((x) => ({
            name: x.VocabularyName,
            languageCode: x.LanguageCode,
            canUse: true,
          }));
        customVocabularies = customVocabularies.concat(vocabulary);
      }
    } while ((response || {}).NextToken);

    return customVocabularies;
  }
}

module.exports = TranscribeOp;
