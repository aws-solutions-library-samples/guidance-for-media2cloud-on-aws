// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  RekognitionClient,
  DescribeProjectVersionsCommand,
  ResourceNotFoundException,
} = require('@aws-sdk/client-rekognition');
const PATH = require('path');
const {
  CommonUtils,
  AnalysisTypes,
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
} = require('core-lib');
const {
  BacklogClient,
} = require('service-backlog-lib');
const BaseStartDetectionIterator = require('../shared/baseStartDetectionIterator');

const CATEGORY = 'rekognition';
const SUBCATEGORY = AnalysisTypes.Rekognition.CustomLabel;
const CUSTOMLABEL_MODELS = 'customLabelModels';
const RUNNABLE_STATUS = [
  'TRAINING_IN_PROGRESS',
  'TRAINING_COMPLETED',
  'STARTING',
  'RUNNING',
  'STOPPING',
  'STOPPED',
];

const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class StartCustomLabelIterator extends BaseStartDetectionIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
    const backlog = new BacklogClient.CustomBacklogJob();
    this.$func = backlog.startCustomLabelsDetection.bind(backlog);
    this.$bestMatch = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'StartCustomLabelIterator';
  }

  get bestMatch() {
    return this.$bestMatch;
  }

  set bestMatch(val) {
    this.$bestMatch = val;
  }

  async process() {
    const data = this.stateData.data[this.subCategory];
    this.bestMatch = await this.bestMatchProjectVersion(data[CUSTOMLABEL_MODELS]);
    return super.process();
  }

  makeParams(id) {
    const data = this.stateData.data[this.subCategory];
    return {
      jobTag: id,
      input: {
        ...data,
        ...this.bestMatch,
      },
      output: {
        bucket: data.bucket,
        prefix: this.makeRawDataPrefix(this.subCategory),
      },
    };
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory];
    const timestamp = CommonUtils.toISODateTime(data.requestTime);
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(data.prefix, 'raw', timestamp, CATEGORY, subCategory, data[CUSTOMLABEL_MODELS], '/');
  }

  async bestMatchProjectVersion(model) {
    let response;
    const projectArn = (model.indexOf('arn:aws:rekognition:') !== 0)
      ? `arn:aws:rekognition:${process.env.AWS_REGION}:${this.stateData.accountId}:project/${model}`
      : model;
    let projectVersions = [];

    do {
      const rekognitionClient = xraysdkHelper(new RekognitionClient({
        customUserAgent: CUSTOM_USER_AGENT,
        retryStrategy: retryStrategyHelper(),
      }));

      const command = new DescribeProjectVersionsCommand({
        ProjectArn: projectArn,
        NextToken: (response || {}).NextToken,
      });

      response = await rekognitionClient.send(command);

      projectVersions = projectVersions.concat(response.ProjectVersionDescriptions);
    } while ((response || {}).NextToken);

    /* filter runnable models and sort by creation date */
    const bestMatch = projectVersions
      .filter((x) =>
        RUNNABLE_STATUS.includes(x.Status))
      .sort((a, b) =>
        new Date(b.CreationTimestamp) - new Date(a.CreationTimestamp))
      .shift();

    if (!bestMatch) {
      throw new ResourceNotFoundException(`fail to find runnable project version for ${projectArn}`);
    }

    return {
      projectArn,
      projectVersionArn: bestMatch.ProjectVersionArn,
    };
  }
}

module.exports = StartCustomLabelIterator;
