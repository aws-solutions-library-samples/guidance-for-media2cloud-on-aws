/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const BaseOp = require('./baseOp');

const OP_CUSTOMVOCABULARIES = 'custom-vocabularies';
const OP_CUSTOMLANGUAGEMODELS = 'custom-language-models';
const STATUS_COMPLETED = 'COMPLETED';
const STATUS_READY = 'READY';

class TranscribeOp extends BaseOp {
  async onPOST() {
    throw new Error('TranscribeOp.onPOST not impl');
  }

  async onDELETE() {
    throw new Error('TranscribeOp.onDELETE not impl');
  }

  async onGET() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_CUSTOMLANGUAGEMODELS) {
      return super.onGET(await this.onGetCustomLanguageModels());
    }
    if (op === OP_CUSTOMVOCABULARIES) {
      return super.onGET(await this.onGetCustomVocabularies());
    }
    throw new Error('invalid operation');
  }

  async onGetCustomLanguageModels() {
    const transcribe = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
    });

    let response;
    const customLanguageModels = [];
    do {
      response = await transcribe.listLanguageModels({
        StatusEquals: STATUS_COMPLETED,
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      }).promise().catch(() => undefined);
      if (response && response.Models.length) {
        const models = response.Models.map(x => ({
          name: x.ModelName,
          languageCode: x.LanguageCode,
          canUse: true,
        }));
        customLanguageModels.splice(customLanguageModels.length, 0, ...models);
      }
    } while ((response || {}).NextToken);
    return customLanguageModels;
  }

  async onGetCustomVocabularies() {
    const transcribe = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
    });

    let response;
    const customVocabularies = [];
    do {
      response = await transcribe.listVocabularies({
        StateEquals: STATUS_READY,
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      }).promise().catch(() => undefined);
      if (response && response.Vocabularies.length) {
        const vocabulary = response.Vocabularies.map(x => ({
          name: x.VocabularyName,
          languageCode: x.LanguageCode,
          canUse: true,
        }));
        customVocabularies.splice(customVocabularies.length, 0, ...vocabulary);
      }
    } while ((response || {}).NextToken);
    return customVocabularies;
  }
}

module.exports = TranscribeOp;