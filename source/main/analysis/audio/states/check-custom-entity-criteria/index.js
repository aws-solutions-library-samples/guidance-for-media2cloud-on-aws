// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const PATH = require('path');
const {
  Environment,
  AnalysisTypes,
  CommonUtils,
  Indexer,
} = require('core-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const INDEX_TRANSCRIBE = 'transcribe';
const CATEGORY = 'comprehend';
const SUB_CATEGORY = AnalysisTypes.Comprehend.CustomEntity;
const DOC_BASENAME = 'document';
const FILLER = '   ';
const MIN_CHARACTERS = 3;
const DOCUMENTS_PER_BATCH = 25;

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
    const indexer = new Indexer();
    const doc = await indexer.getDocument(INDEX_TRANSCRIBE, this.stateData.uuid)
      .catch((e) =>
        console.error(`[ERR]: indexer.getDocument: ${this.stateData.uuid} ${JSON.stringify(e.body, null, 2)}`));
    if (!doc || doc.data.length === 0) {
      return this.dataLessThenThreshold();
    }
    /* preparing the document for analysis. */
    /* At most 25 lines per document. Each line is less than 5KB */
    const bucket = this.stateData.input.destination.bucket;
    const documents = [];
    while (doc.data.length) {
      documents.push(this.prepareDocument(doc.data));
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
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    const recognizer = await comprehend.describeEntityRecognizer({
      EntityRecognizerArn: arn,
    }).promise()
      .then(data => ({
        arn: data.EntityRecognizerProperties.EntityRecognizerArn,
        languageCode: data.EntityRecognizerProperties.LanguageCode,
        canUse: data.EntityRecognizerProperties.Status === 'TRAINED'
          || data.EntityRecognizerProperties.Status === 'STOPPED',
      }))
      .catch(() => undefined);

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
