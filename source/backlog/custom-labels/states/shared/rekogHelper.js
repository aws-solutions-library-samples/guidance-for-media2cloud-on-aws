// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  RekognitionClient,
  StartProjectVersionCommand,
  DescribeProjectVersionsCommand,
  DetectCustomLabelsCommand,
} = require('@aws-sdk/client-rekognition');
const {
  BacklogClient: {
    CustomBacklogJob,
  },
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
  },
  xraysdkHelper,
  retryStrategyHelper,
} = require('service-backlog-lib');

class RekogHelper {
  static async startProjectVersion(params) {
    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new StartProjectVersionCommand(params);
    return rekognitionClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  static async describeProjectVersion(projectArn, projectVersionArn) {
    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DescribeProjectVersionsCommand({
      ProjectArn: projectArn,
      MaxResults: 1,
      VersionNames: [
        projectVersionArn.split('/')[3],
      ],
    });

    const response = await rekognitionClient.send(command);

    while (response.ProjectVersionDescriptions.length) {
      const item = response.ProjectVersionDescriptions.shift();
      if (item.ProjectVersionArn === projectVersionArn) {
        return {
          status: item.Status,
          inferenceUnits: item.MinInferenceUnits,
        };
      }
    }

    return {
      status: 'UNKNOWN',
    };
  }

  static async detectCustomLabels(params) {
    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DetectCustomLabelsCommand(params);

    return rekognitionClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  static async updateProjectVersionTTL(projectVersionArn, ttl) {
    return CustomBacklogJob.updateTTL(projectVersionArn, ttl);
  }
}

module.exports = RekogHelper;
