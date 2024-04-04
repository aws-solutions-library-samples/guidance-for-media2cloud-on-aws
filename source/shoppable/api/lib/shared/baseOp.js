// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');
const {
  MethodNotAllowedException,
} = require('./exceptions');

const ECOMMERCE_CONFIG_SECRETS = process.env.ENV_ECOMMERCE_CONFIG_SECRETS;

const ALLOW_METHODS = [
  'GET',
  'OPTIONS',
];

const ALLOW_HEADERS = [
  'Authorization',
  'Host',
  'Content-Type',
  'X-Amz-Date',
  'X-Api-Key',
  'X-Amz-Security-Token',
  'x-amz-content-sha256',
  'x-amz-user-agent',
  'x-api-key',
];

class BaseOp {
  constructor(request, context) {
    this.$request = request;
    this.$context = context;
    const qs = request.queryStringParameters || {};
    this.$queryString = Object.keys(qs).reduce((a0, c0) => ({
      ...a0,
      [c0]: decodeURIComponent(qs[c0]),
    }), {});
  }

  static opSupported(op) {
    return false;
  }

  get request() {
    return this.$request;
  }

  get context() {
    return this.$context;
  }

  get queryString() {
    return this.$queryString;
  }

  getCORS(data) {
    const headers = this.request.headers;
    return {
      'Content-Type': (typeof data === 'string')
        ? 'text/plain'
        : 'application/json',
      'Access-Control-Allow-Methods': ALLOW_METHODS.join(', '),
      'Access-Control-Allow-Headers': ALLOW_HEADERS.join(', '),
      'Access-Control-Allow-Origin': headers.Origin
        || headers.origin
        || headers['X-Forwarded-For']
        || '*',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  async onOPTIONS() {
    return {
      statusCode: 200,
      headers: this.getCORS(),
    };
  }

  async onGET(response) {
    return this.onSucceed(response);
  }

  async onPOST(response) {
    throw new MethodNotAllowedException();
  }

  async onDELETE(response) {
    throw new MethodNotAllowedException();
  }

  onSucceed(payload) {
    return {
      statusCode: 200,
      headers: this.getCORS(payload),
      body: (typeof payload === 'string')
        ? payload
        : JSON.stringify(payload),
    };
  }

  onError(e) {
    return {
      statusCode: 200,
      headers: this.getCORS(),
      body: JSON.stringify({
        errorCode: e.errorCode || 500,
        errorMessage: e.message,
      }),
    };
  }

  async getConfig() {
    const manager = new SecretsManagerClient();

    const params = {
      SecretId: ECOMMERCE_CONFIG_SECRETS,
    };
    const command = new GetSecretValueCommand(params);

    return manager.send(command)
      .then((res) =>
        JSON.parse(res.SecretString));
  }

  async invokeApi(url, options) {
    let response = await fetch(url, options)
      .then((res) =>
        res.text());

    response = await response;

    return JSON.parse(response);
  }
}

module.exports = BaseOp;
