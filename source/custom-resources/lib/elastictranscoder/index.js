// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const mxBaseResponse = require('../shared/mxBaseResponse');

/**
 * @class ETS
 * @description Elastic Transcoder service
 */
class ETS extends mxBaseResponse(class {}) {
  constructor(event, context) {
    super(event, context);
    /* sanity check */
    const data = event.ResourceProperties.Data;
    this.sanityCheck(data);
    this.$data = data;
    /* pipeline name max length is 40 */
    this.$data.Name = data.Name.slice(0, 40);
    this.$instance = new AWS.ElasticTranscoder({
      apiVersion: '2012-09-25',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
  }

  sanityCheck(data) {
    let missing = [
      'Name',
      'InputBucket',
      'OutputBucket',
      'Role',
      'Notifications',
    ].filter(x => data[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }
    missing = [
      'Progressing',
      'Completed',
      'Warning',
      'Error',
    ].filter(x => data.Notifications[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }
  }

  get data() {
    return this.$data;
  }

  get instance() {
    return this.$instance;
  }

  async create() {
    const response = await this.instance.createPipeline({
      ...this.data,
    }).promise();
    this.storeResponseData('PipelineId', response.Pipeline.Id);
    this.storeResponseData('PipelineName', response.Pipeline.Name);
    this.storeResponseData('PipelineArn', response.Pipeline.Arn);
    this.storeResponseData('Status', 'SUCCESS');
    return this.responseData;
  }

  async purge() {
    let found;
    let response;
    do {
      response = await this.instance.listPipelines({
        PageToken: (response || {}).NextPageToken,
      }).promise();
      found = response.Pipelines.find(x => x.Name === this.data.Name);
    } while (!found && (response || {}).NextPageToken);

    await this.instance.deletePipeline({
      Id: found.Id,
    }).promise();

    this.storeResponseData('Status', 'SUCCESS');
    return this.responseData;
  }

  async update() {
    await this.purge();
    await this.create();
    this.storeResponseData('Status', 'SUCCESS');
    return this.responseData;
  }
}

/**
 * @function CreatePipeline
 * @param {object} event
 * @param {object} context
 */
exports.CreatePipeline = async (event, context) => {
  const instance = new ETS(event, context);
  if (instance.isRequestType('Delete')) {
    return instance.purge();
  }
  if (instance.isRequestType('Update')) {
    return instance.update();
  }

  return instance.create();
};
