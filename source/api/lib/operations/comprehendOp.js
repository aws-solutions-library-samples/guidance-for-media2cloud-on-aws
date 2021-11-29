// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  Environment,
} = require('core-lib');
const BaseOp = require('./baseOp');

const OP_CUSTOMENTITYRECOGNIERS = 'custom-entity-recognizers';
const STATUS_TRAINED = 'TRAINED';

class ComprehendOp extends BaseOp {
  async onPOST() {
    throw new Error('ComprehendOp.onPOST not impl');
  }

  async onDELETE() {
    throw new Error('ComprehendOp.onDELETE not impl');
  }

  async onGET() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_CUSTOMENTITYRECOGNIERS) {
      return super.onGET(await this.onGetCustomEntityRecognizers());
    }
    throw new Error('invalid operation');
  }

  async onGetCustomEntityRecognizers() {
    const comprehend = new AWS.Comprehend({
      apiVersion: '2017-11-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });

    let response;
    const entityRecognizers = [];
    do {
      response = await comprehend.listEntityRecognizers({
        Filter: {
          Status: STATUS_TRAINED,
        },
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      }).promise().catch(() => undefined);
      if (response && response.EntityRecognizerPropertiesList.length) {
        const arns = response.EntityRecognizerPropertiesList.map(x => ({
          name: x.EntityRecognizerArn.split('/').pop(),
          languageCode: x.LanguageCode,
          canUse: true,
        }));
        entityRecognizers.splice(entityRecognizers.length, 0, ...arns);
      }
    } while ((response || {}).NextToken);
    return entityRecognizers;
  }
}

module.exports = ComprehendOp;
