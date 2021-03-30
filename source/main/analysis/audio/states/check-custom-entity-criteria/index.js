/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const PATH = require('path');
const AWS = require('aws-sdk');
const {
  CommonUtils,
} = require('core-lib');
const {
  CueLineQ,
} = require('../shared/cueLine');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const PREV_STATE = 'transcribe';
const CATEGORY = 'comprehend';
const SUB_CATEGORY = 'custom-entity';
const MIN_WORD_COUNTS = 2;
const SLICES_PER_PROCESS = 25;
const DOC_BASENAME = 'document';
const FILLER = '   ';

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
    if (!await this.checkCriteria()) {
      return this.dataLessThenThreshold();
    }
    /* download cuelines */
    const bucket = this.stateData.input.destination.bucket;
    const cuelines = await this.downloadCuelineResult();
    /* preparing the document for analysis. */
    /* At most 25 lines per document. Each line is less than 5KB */
    const documents = [];
    while (cuelines.length) {
      const linesPerDocument = [];
      const slices = cuelines.splice(0, SLICES_PER_PROCESS);
      while (slices.length) {
        const queue = CueLineQ.createFromJson(slices.shift());
        if (queue.wordCounts > MIN_WORD_COUNTS) {
          linesPerDocument.push(queue.reduceAll().content);
        } else {
          /* filler to keep the line indices aliged */
          linesPerDocument.push(FILLER);
        }
      }
      documents.push(linesPerDocument);
    }
    if (!documents.length) {
      return this.dataLessThenThreshold();
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

  async checkCriteria() {
    const prevState = this.stateData.data[PREV_STATE];
    if (!prevState.cuelines || prevState.totalWordCounts <= MIN_WORD_COUNTS) {
      return false;
    }
    const name = this.stateData.input.aiOptions.customEntityRecognizer;
    if (!name) {
      return false;
    }
    const languageCode = this.getComprehendLanguageCode();
    const recognizer = await this.getCustomEntityRecognizer(name);
    if (!recognizer.canUse || recognizer.languageCode !== languageCode) {
      return false;
    }
    return true;
  }

  async getCustomEntityRecognizer(name) {
    if (!name) {
      return undefined;
    }
    const arn = `arn:aws:comprehend:${process.env.AWS_REGION}:${this.stateData.accountId}:entity-recognizer/${name}`;
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
    });
    return comprehend.describeEntityRecognizer({
      EntityRecognizerArn: arn,
    }).promise()
      .then(data => ({
        arn: data.EntityRecognizerProperties.EntityRecognizerArn,
        languageCode: data.EntityRecognizerProperties.LanguageCode,
        canUse: data.EntityRecognizerProperties.Status === 'TRAINED'
          || data.EntityRecognizerProperties.Status === 'STOPPED',
      }))
      .catch(() => undefined);
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
