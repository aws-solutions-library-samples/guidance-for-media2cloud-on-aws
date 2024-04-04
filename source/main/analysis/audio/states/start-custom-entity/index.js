// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const CRYPTO = require('crypto');
const PATH = require('path');
const {
  AnalysisTypes: {
    Comprehend: {
      CustomEntity,
    },
  },
  ServiceToken,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStateStartComprehend = require('../shared/baseStateStartComprehend');

const CATEGORY = 'comprehend';
const DOC_BASENAME = 'document';

class StateStartCustomEntity extends BaseStateStartComprehend {
  constructor(stateData) {
    super(stateData, {
      subCategory: CustomEntity,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartCustomEntity';
  }

  async process() {
    let id = CRYPTO.randomBytes(4).toString('hex');
    id = `${this.stateData.uuid}-${CustomEntity}-${id}`;
    const output = {
      [CustomEntity]: {
        ...this.stateData.data[CATEGORY][CustomEntity],
        backlogId: id,
        startTime: (new Date()).getTime(),
      },
    };
    this.stateData.setData(CATEGORY, output);
    /* register service token to get notification when job started */
    await ServiceToken.register(
      id,
      this.stateData.event.token,
      CATEGORY,
      CustomEntity,
      this.stateData.toJSON()
    ).catch((e) => {
      console.error(`ERR: ServiceToken.register: ${e.message}`);
      throw e;
    });
    /* submit job to backlog */
    const params = this.makeParams(id);
    const backlog = new BacklogClient.ComprehendBacklogJob();
    await backlog.startEntitiesDetectionJob(id, params).catch((e) => {
      console.error(`ERR: backlog.startEntitiesDetectionJob: ${e.message}`);
      throw e;
    });
    return this.stateData.toJSON();
  }

  makeParams(id) {
    const bucket = this.stateData.input.destination.bucket;
    const prefix = this.stateData.data[CATEGORY][CustomEntity].prefix;
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
