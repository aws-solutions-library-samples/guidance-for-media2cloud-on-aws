// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  CodeBuildClient,
  StartBuildCommand,
} = require('@aws-sdk/client-codebuild');
const mxBaseResponse = require('../shared/mxBaseResponse');

/**
 * @function StartBuild
 * @param {object} event
 * @param {object} context
 */
exports.StartBuild = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    // not handle Delete event
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data;
    const missing = [
      'projectName',
      'environmentVariablesOverride',
    ].filter((x) =>
      data[x] === undefined);

    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    const codebuild = new CodeBuildClient();

    const command = new StartBuildCommand(data);

    return codebuild.send(command)
      .then((res) => {
        x0.storeResponseData('Id', res.build.id);
        x0.storeResponseData('Arn', res.build.arn);
        x0.storeResponseData('Status', 'SUCCESS');
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'StartBuild:',
      'StartBuildCommand:',
      (e.$metadata || {}).httpStatusCode || 500,
      e.name,
      e.message
    );
    throw e;
  }
};

/**
 * @function PostBuild
 * @param {object} event
 * @param {object} context
 */
exports.PostBuild = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    // not handle Delete event
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data;
    const missing = [
      'WaitConditionData',
    ].filter((x) =>
      data[x] === undefined);

    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    Object.keys(data)
      .forEach((key) => {
        x0.storeResponseData(key, data[key]);
      });

    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    console.error(
      'ERR:',
      'PostBuild:',
      (e.$metadata || {}).httpStatusCode || 500,
      e.name,
      e.message
    );
    throw e;
  }
};

/**
 * @function StartBuildDelayResponse
 * @param {object} event
 * @param {object} context
 */
exports.StartBuildDelayResponse = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    // not handle Delete event
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data;
    const missing = [
      'projectName',
      'environmentVariablesOverride',
    ].filter((x) =>
      data[x] === undefined);

    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    // adding CFN_xxx for codebuild to signal cloudformation stack
    data.environmentVariablesOverride.push({
      type: 'PLAINTEXT',
      name: 'CFN_ResponseURL',
      value: event.ResponseURL,
    });
    data.environmentVariablesOverride.push({
      type: 'PLAINTEXT',
      name: 'CFN_PhysicalResourceId',
      value: event.PhysicalResourceId || context.logStreamName,
    });
    data.environmentVariablesOverride.push({
      type: 'PLAINTEXT',
      name: 'CFN_StackId',
      value: event.StackId,
    });
    data.environmentVariablesOverride.push({
      type: 'PLAINTEXT',
      name: 'CFN_RequestId',
      value: event.RequestId,
    });
    data.environmentVariablesOverride.push({
      type: 'PLAINTEXT',
      name: 'CFN_LogicalResourceId',
      value: event.LogicalResourceId,
    });

    const codebuild = new CodeBuildClient();

    const command = new StartBuildCommand(data);

    return codebuild.send(command)
      .then((res) => {
        x0.storeResponseData('Id', res.build.id);
        x0.storeResponseData('Arn', res.build.arn);
        x0.storeResponseData('Status', 'SUCCESS');
        x0.storeResponseData('DELAYRESPONSE', '1');
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'StartBuild:',
      'StartBuildCommand:',
      (e.$metadata || {}).httpStatusCode || 500,
      e.name,
      e.message
    );
    throw e;
  }
};
