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
const PATH = require('path');
const {
  CommonUtils,
  AnalysisTypes,
  AnalysisError,
  Environment,
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
const NON_RUNNABLE_STATUS = [
  'TRAINING_FAILED',
  'FAILED',
  'DELETING',
];

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
    return PATH.join(
      data.prefix,
      'raw',
      timestamp,
      CATEGORY,
      subCategory,
      data[CUSTOMLABEL_MODELS],
      '/'
    );
  }

  async bestMatchProjectVersion(model) {
    let response;
    const projectArn = (model.indexOf('arn:aws:rekognition:') !== 0)
      ? `arn:aws:rekognition:${process.env.AWS_REGION}:${this.stateData.accountId}:project/${model}`
      : model;
    const projectVersions = [];
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    do {
      response = await rekog.describeProjectVersions({
        ProjectArn: projectArn,
        NextToken: (response || {}).NextToken,
      }).promise();
      projectVersions.splice(projectVersions.length, 0, ...response.ProjectVersionDescriptions);
    } while ((response || {}).NextToken);
    /* filter runnable models and sort by creation date */
    const bestMatch = projectVersions.filter(x =>
      RUNNABLE_STATUS.indexOf(x.Status) >= 0)
      .sort((a, b) =>
        new Date(b.CreationTimestamp) - new Date(a.CreationTimestamp))
      .shift();
    if (!bestMatch) {
      throw new AnalysisError(`fail to find runnable project version for ${projectArn}`);
    }
    return {
      projectArn,
      projectVersionArn: bestMatch.ProjectVersionArn,
    };
  }
}

module.exports = StartCustomLabelIterator;
