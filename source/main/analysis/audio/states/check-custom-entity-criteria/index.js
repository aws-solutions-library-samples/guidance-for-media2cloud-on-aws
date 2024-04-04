// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ComprehendClient,
  DescribeEntityRecognizerCommand,
} = require('@aws-sdk/client-comprehend');
const PATH = require('path');
const {
  Environment,
  AnalysisTypes,
  CommonUtils,
  xraysdkHelper,
  retryStrategyHelper,
} = require('core-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const INDEX_TRANSCRIBE = 'transcribe';
const CATEGORY = 'comprehend';
const SUB_CATEGORY = AnalysisTypes.Comprehend.CustomEntity;
const DOC_BASENAME = 'document';
const FILLER = '   ';
const MIN_CHARACTERS = 3;
const DOCUMENTS_PER_BATCH = 25;
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class StateCheckCustomEntityCriteria extends BaseStateStartComprehend {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: () => {},
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateCheckCustomEntityCriteria';
  }

  async process() {
    if (!this.checkCriteria()) {
      return this.dataLessThenThreshold();
    }
    if (!(await this.getCustomEntityRecognizer())) {
      return this.dataLessThenThreshold();
    }

    /* download indexed transcription */
    const doc = await this.getTranscribeResults();
    if (!doc || doc.length === 0) {
      return this.dataLessThenThreshold();
    }

    /* preparing the document for analysis. */
    /* At most 25 lines per document. Each line is less than 5KB */
    const bucket = this.stateData.input.destination.bucket;
    const documents = [];
    while (doc.length) {
      documents.push(this.prepareDocument(doc));
    }
    /* upload input documents */
    const numOutputs = documents.length;
    const prefix = this.makeRawDocumentPrefix();
    let idx = 0;
    while (documents.length) {
      const document = documents.shift();
      const name = `${DOC_BASENAME}-${String(idx++).padStart(4, '0')}.txt`;
      await CommonUtils.uploadFile(bucket, prefix, name, document.join('\n'));
    }
    const output = {
      [SUB_CATEGORY]: {
        prefix,
        numOutputs,
      },
    };
    this.stateData.setData(CATEGORY, output);
    return this.stateData.toJSON();
  }

  prepareDocument(datasets) {
    const document = [];
    while (datasets.length) {
      const data = datasets.shift();
      document.push((Buffer.from(data.name) <= MIN_CHARACTERS)
        ? FILLER
        : data.name);
      if (document.length === DOCUMENTS_PER_BATCH) {
        return document;
      }
    }
    return document;
  }

  async getCustomEntityRecognizer() {
    const name = this.stateData.input.aiOptions.customEntityRecognizer;
    if (!name) {
      return undefined;
    }
    const languageCode = this.getComprehendLanguageCode();
    const arn = `arn:aws:comprehend:${process.env.AWS_REGION}:${this.stateData.accountId}:entity-recognizer/${name}`;

    const comprehendClient = xraysdkHelper(new ComprehendClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DescribeEntityRecognizerCommand({
      EntityRecognizerArn: arn,
    });

    const recognizer = await comprehendClient.send(command)
      .then((res) => ({
        arn: res.EntityRecognizerProperties.EntityRecognizerArn,
        languageCode: res.EntityRecognizerProperties.LanguageCode,
        canUse: res.EntityRecognizerProperties.Status === 'TRAINED'
          || res.EntityRecognizerProperties.Status === 'STOPPED',
      }))
      .catch(() =>
        undefined);

    return (recognizer
      && recognizer.canUse
      && recognizer.languageCode === languageCode)
      ? recognizer
      : undefined;
  }

  makeRawDocumentPrefix() {
    const timestamp = CommonUtils.toISODateTime((this.stateData.input.request || {}).timestamp);
    return PATH.join(
      this.stateData.input.destination.prefix,
      'raw',
      timestamp,
      CATEGORY,
      SUB_CATEGORY,
      '/'
    );
  }
}

module.exports = StateCheckCustomEntityCriteria;
