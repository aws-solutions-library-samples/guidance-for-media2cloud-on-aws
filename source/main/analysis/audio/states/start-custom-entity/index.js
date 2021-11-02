// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const CRYPTO = require('crypto');
const PATH = require('path');
const {
  AnalysisTypes,
  ServiceToken,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const CATEGORY = 'comprehend';
const SUB_CATEGORY = AnalysisTypes.Comprehend.CustomEntity;
const DOC_BASENAME = 'document';

class StateStartCustomEntity extends BaseStateStartComprehend {
  constructor(stateData) {
    super(stateData, {
      subCategory: SUB_CATEGORY,
      func: () => {},
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartCustomEntity';
  }

  async process() {
    let id = CRYPTO.randomBytes(4).toString('hex');
    id = `${this.stateData.uuid}-${SUB_CATEGORY}-${id}`;
    const output = {
      [SUB_CATEGORY]: {
        ...this.stateData.data[CATEGORY][SUB_CATEGORY],
        backlogId: id,
        startTime: (new Date()).getTime(),
      },
    };
    this.stateData.setData(CATEGORY, output);
    /* submit job to backlog */
    const params = this.makeParams(id);
    const backlog = new BacklogClient.ComprehendBacklogJob();
    await backlog.startEntitiesDetectionJob(id, params).catch((e) => {
      console.error(`ERR: backlog.startEntitiesDetectionJob: ${e.message}`);
      throw e;
    });
    /* register service token to get notification when job started */
    await ServiceToken.register(
      id,
      this.stateData.event.token,
      CATEGORY,
      SUB_CATEGORY,
      this.stateData.toJSON()
    ).catch((e) => {
      console.error(`ERR: ServiceToken.register: ${e.message}`);
      throw e;
    });
    return this.stateData.toJSON();
  }

  makeParams(id) {
    const bucket = this.stateData.input.destination.bucket;
    const prefix = this.stateData.data[CATEGORY][SUB_CATEGORY].prefix;
    const languageCode = this.getComprehendLanguageCode();
    const arn = [
      'arn:aws:comprehend',
      process.env.AWS_REGION,
      this.stateData.accountId,
      `entity-recognizer/${this.stateData.input.aiOptions.customEntityRecognizer}`,
    ].join(':');
    return {
      JobName: id,
      EntityRecognizerArn: arn,
      LanguageCode: languageCode,
      InputDataConfig: {
        S3Uri: `s3://${PATH.join(bucket, prefix, DOC_BASENAME)}`,
        InputFormat: 'ONE_DOC_PER_LINE',
      },
      OutputDataConfig: {
        S3Uri: `s3://${PATH.join(bucket, prefix)}`,
      },
    };
  }
}

module.exports = StateStartCustomEntity;
