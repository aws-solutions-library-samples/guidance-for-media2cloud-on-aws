// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  ComprehendClient,
  ListEntityRecognizersCommand,
} = require('@aws-sdk/client-comprehend');
const {
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const OP_CUSTOMENTITYRECOGNIERS = 'custom-entity-recognizers';
const STATUS_TRAINED = 'TRAINED';
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class ComprehendOp extends BaseOp {
  async onPOST() {
    throw new M2CException('ComprehendOp.onPOST not impl');
  }

  async onDELETE() {
    throw new M2CException('ComprehendOp.onDELETE not impl');
  }

  async onGET() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_CUSTOMENTITYRECOGNIERS) {
      return super.onGET(await this.onGetCustomEntityRecognizers());
    }
    throw new M2CException('invalid operation');
  }

  async onGetCustomEntityRecognizers() {
    let response;
    let entityRecognizers = [];
    do {
      const comprehendClient = xraysdkHelper(new ComprehendClient({
        customUserAgent: CUSTOM_USER_AGENT,
        retryStrategy: retryStrategyHelper(),
      }));

      const command = new ListEntityRecognizersCommand({
        Filter: {
          Status: STATUS_TRAINED,
        },
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      });

      response = await comprehendClient.send(command)
        .catch(() =>
          undefined);

      if (response && response.EntityRecognizerPropertiesList.length) {
        const arns = response.EntityRecognizerPropertiesList
          .map((x) => ({
            name: x.EntityRecognizerArn.substring(
              x.EntityRecognizerArn.indexOf('/') + 1
            ),
            languageCode: x.LanguageCode,
            canUse: true,
          }));
        entityRecognizers = entityRecognizers.concat(arns);
      }
    } while ((response || {}).NextToken);
    return entityRecognizers;
  }
}

module.exports = ComprehendOp;
