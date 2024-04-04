// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

class BaseOp {
  constructor(request) {
    this.$request = request;
  }

  static get Constants() {
    return {
      AllowMethods: [
        'POST',
        'GET',
        'DELETE',
        'OPTIONS',
      ],
      AllowHeaders: [
        'Authorization',
        'Host',
        'Content-Type',
        'X-Amz-Date',
        'X-Api-Key',
        'X-Amz-Security-Token',
        'x-amz-content-sha256',
        'x-amz-user-agent',
      ],
    };
  }

  getCors(data) {
    const h0 = this.request.headers;
    return {
      'Content-Type': (typeof data === 'string')
        ? 'text/plain'
        : 'application/json',
      'Access-Control-Allow-Methods': BaseOp.Constants.AllowMethods.join(', '),
      'Access-Control-Allow-Headers': BaseOp.Constants.AllowHeaders.join(', '),
      'Access-Control-Allow-Origin': h0.Origin || h0.origin || h0['X-Forwarded-For'] || '*',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  get request() {
    return this.$request;
  }

  get responseData() {
    return this.$responseData;
  }

  set responseData(val) {
    this.$responseData = val;
  }

  async onOPTIONS() {
    return {
      statusCode: 200,
      headers: this.getCors(),
    };
  }

  async onGET(response) {
    return this.onSucceed(response);
  }

  async onPOST(response) {
    return this.onSucceed(response);
  }

  async onDELETE(response) {
    return this.onSucceed(response);
  }

  onSucceed(payload) {
    return {
      statusCode: 200,
      headers: this.getCors(payload),
      body: (typeof payload === 'string')
        ? payload
        : JSON.stringify(payload),
    };
  }

  onError(e) {
    const payload = {
      errorCode: 500,
      errorName: e.name || e.code,
      errorMessage: `${this.request.method} ${this.request.path} - ${e.name || e.code || e.message || 'unknown error'}`,
    };
    console.error(JSON.stringify(payload, null, 2));
    return {
      statusCode: 200,
      headers: this.getCors(payload),
      body: JSON.stringify(payload),
    };
  }
}

module.exports = BaseOp;
