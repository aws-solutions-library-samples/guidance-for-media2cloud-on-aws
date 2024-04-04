// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');

const {
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');

const REGION = process.env.ENV_BEDROCK_REGION;

class BaseModel {
  static canSupport(modelId) {
    if (REGION !== undefined && REGION.length > 0) {
      return true;
    }
    return false;
  }

  get modelId() {
    return undefined;
  }

  createModelInput(options) {
    return options;
  }

  async inference(task, params) {
    throw new M2CException('not implemented');
  }

  async invokeModel(params) {
    const runtimeClient = xraysdkHelper(new BedrockRuntimeClient({
      region: REGION,
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new InvokeModelCommand(params);

    const response = await runtimeClient.send(command)
      .catch((e) => {
        if (e.code === 'ENOTFOUND') {
          e.name = 'ServiceUnavailableException';
          console.log(`=== Bedrock not supported in ${REGION} (${e.code})`);
        } else if (e.name === 'ResourceNotFoundException') {
          console.log(`=== Make sure to request access to the model, ${params.modelId} in ${REGION} (${e.code})`);
        } else if (e.name === 'AccessDeniedException') {
          console.log(`=== Make sure to request access to the model, ${params.modelId} in ${REGION} (${e.code})`);
        }
        throw e;
      });

    let output = new TextDecoder().decode(response.body);
    output = JSON.parse(output);

    return output;
  }
}

module.exports = BaseModel;
