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
const CRYPTO = require('crypto');
const mxBaseResponse = require('../shared/mxBaseResponse');

/**
 * @function StringManipulation
 * @param {object} event
 * @param {object} context
 */
exports.StringManipulation = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    /* if is 'Update', find the previous OutputString we generated */
    if (x0.isRequestType('Update') && event.ResourceProperties.OutputReference) {
      const result = await (new AWS.CloudFormation({
        apiVersion: '2010-05-15',
        customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
      })).describeStacks({
        StackName: event.StackId.split('/')[1],
      }).promise().catch(() => undefined);

      if (result && result.Stacks.length) {
        const out = result.Stacks.shift().Outputs.find(x =>
          x.OutputKey === event.ResourceProperties.OutputReference);
        if ((out || {}).OutputValue) {
          x0.storeResponseData('OutputString', out.OutputValue);
          x0.storeResponseData('Status', 'SUCCESS');
          return x0.responseData;
        }
      }
    }

    /* Support 'InputString' and 'Operations' parameters only */
    /* where Operations is specified as a string, comma separator */
    /* lower, upper, maxlen=20, minlen=3, random, underscore, dash, alphanumeric */
    const {
      InputString,
      Operations = '',
    } = event.ResourceProperties.Data;

    /* extract operation(s) */
    const operations = Operations.split(',').map(x => x.toLowerCase().trim()).filter(x => x).reduce((acc, cur) => {
      const [
        key,
        val,
      ] = cur.split('=').map(x => x.trim());
      return {
        ...acc,
        [key]: val || true,
      };
    }, undefined);
    console.log(JSON.stringify(operations, null, 2));

    /* process the operations */
    let fragment = InputString || '';
    if (operations.alphanumeric) {
      fragment = fragment.replace(/[^a-zA-Z0-9]+/g, '');
    }
    if (operations.random) {
      let random = Number.parseInt(operations.random || 8, 10);
      /* operations.random must be at least 4 */
      random = Math.floor(((random < 4) ? 4 : random) / 2);
      fragment = `${fragment}-${CRYPTO.randomBytes(random).toString('hex')}`;
    }
    if (operations.upper) {
      fragment = fragment.toUpperCase();
    }
    if (operations.lower) {
      fragment = fragment.toLowerCase();
    }
    if (operations.underscore) {
      // '__abc 123 ,.<>/!@$#-_ def___'
      //  .replace(/[^a-zA-Z0-9_-]+/g, '_')
      //  .replace(/_+/g, '_')
      //  .replace(/_*$/, '')
      //  .replace(/^_*/, '')
      fragment = fragment.replace(/[\s-]/g, '_');
    }
    if (operations.dash) {
      fragment = fragment.replace(/[\s_]/g, '-');
    }
    if (operations.minlen) {
      const padding = Number.parseInt(operations.minlen, 10) - fragment.length;
      for (let i = 0; i < padding; i += 1) {
        fragment += '0';
      }
    }
    if (operations.maxlen) {
      const max = Number.parseInt(operations.maxlen, 10);
      fragment = fragment.substr(0, max);
    }

    x0.storeResponseData('OutputString', fragment);
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `StringManipulation: ${e.message}`;
    throw e;
  }
};
