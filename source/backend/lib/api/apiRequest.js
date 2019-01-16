/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-destructuring */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');
const {
  VideoAsset,
  DBConfig,
  StateIOData,
} = require('../common');

const ALLOWED_METHODS = [
  'POST',
  'GET',
  'OPTIONS',
];

const ALLOWED_HEADERS = [
  'Authorization',
  'Host',
  'Content-Type',
  'X-Amz-Date',
  'X-Api-Key',
  'X-Amz-Security-Token',
  'x-amz-content-sha256',
  'x-amz-user-agent',
];

/* to attach iot policy to the cognito user */
const ATTACH_IOT_POLICY_ENDPOINT = 'attach-iot-policy';

class ApiRequest {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;

    const {
      invokedFunctionArn,
    } = context;
    this.$accountId = invokedFunctionArn.split(':')[4];
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get accountId() {
    return this.$accountId;
  }

  get requestMethod() {
    return this.event.httpMethod;
  }

  get requestHeaders() {
    return this.event.headers;
  }

  get requestQueryString() {
    return this.event.queryStringParameters;
  }

  get requestPathParameters() {
    return this.event.pathParameters;
  }

  get requestBody() {
    return this.event.body;
  }

  /**
   * @function getCORS
   * @description return CORS based on origin in request headers
   */
  getCORS() {
    const {
      Origin = null,
      origin = null,
      'X-Forwarded-For': XFF = '*',
    } = this.requestHeaders || {};

    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
      'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
      'Access-Control-Allow-Origin': Origin || origin || XFF,
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  /**
   * @function onOPTIONS
   * @description handle preflight request, simply return CORS
   */
  async onOPTIONS() {
    return {
      statusCode: 200,
      headers: this.getCORS(),
    };
  }

  /**
   * @function onGET
   * @description get state machine current status, ie.,
   * GET /{stage}/{operation}?executionArn=arn:aws:states:<region>:xx:execution:<stateMachine>:x
   * @param {object} event
   */
  async onGET() {
    const {
      operation,
    } = this.requestPathParameters || {};

    if (operation === ATTACH_IOT_POLICY_ENDPOINT) {
      process.env.ENV_QUIET || console.log(JSON.stringify(`onGET.${ATTACH_IOT_POLICY_ENDPOINT} is called. nothing to do...`));
      return { statusCode: 200, headers: this.getCORS(), body: '' };
    }

    const {
      executionArn,
    } = this.requestQueryString || {};
    if (!executionArn) {
      throw new SyntaxError('missing executionArn querystring');
    }

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    const response = await step.describeExecution({
      executionArn: decodeURIComponent(executionArn),
    }).promise();

    const responseData = {
      statusCode: 200,
      headers: this.getCORS(),
      body: JSON.stringify(response),
    };

    process.env.ENV_QUIET || console.log(`onGET.responseData = ${JSON.stringify(responseData, null, 2)}`);
    return responseData;
  }

  /**
   * @function onPOST
   * @description starting a state machine, ie.,
   * POST /{stage}/{operation}
   * Body:
   * {
   *   Config: { Table, PartitionKey },
   *   Data: { Bucket, Key }
   * }
   */
  async onPOST() {
    const {
      operation,
    } = this.requestPathParameters || {};
    if (!operation) {
      throw new SyntaxError('missing operation pathParameters');
    }

    /* request to attach iot policy to cognito user */
    if (operation === ATTACH_IOT_POLICY_ENDPOINT) {
      const response = await this.onAttachIotPolicy();
      process.env.ENV_QUIET || console.log(JSON.stringify(`onPOST.${ATTACH_IOT_POLICY_ENDPOINT}: ${JSON.stringify(response, null, 2)}`));
      return {
        statusCode: 200,
        headers: this.getCORS(),
        body: JSON.stringify(response),
      };
    }

    const stateData = new StateIOData({
      Service: 'aws.apigateway',
      State: 'apigateway',
      StateMachine: operation,
      Status: 'STARTED',
    });

    /* Step 1: load configuraiton from DB */
    const {
      Config,
      Data,
    } = JSON.parse(this.requestBody);
    const config = new DBConfig(Config);
    stateData.config = config;

    /* Step 2: prepare state machine input parameters */
    const asset = await (async () => {
      if (operation === config.ingestStateMachine) {
        const instance = await ApiRequest.onIngestStateMachine(Data, config);
        return instance;
      } else if (operation === config.metadataStateMachine) {
        stateData.dataInTransit = this.requestQueryString;
        const instance = await ApiRequest.onMetadataStateMachine(Data, config);
        return instance;
      }
      throw new Error(`Operation (${operation}) not supported`);
    })();
    stateData.data = asset;

    /* arn:aws:states:eu-west-1:xx:stateMachine:<state-machine-name> */
    const stateMachineArn = `arn:aws:states:${process.env.AWS_REGION}:${this.accountId}:stateMachine:${operation}`;

    const step = new AWS.StepFunctions({ apiVersion: '2016-11-23' });
    process.env.ENV_QUIET || console.log(`startExecution.input = ${JSON.stringify(stateData.toJSON(), null, 2)}`);

    const response = await step.startExecution({
      input: JSON.stringify(stateData.toJSON()),
      stateMachineArn,
    }).promise();

    const responseData = {
      statusCode: 200,
      headers: this.getCORS(),
      body: JSON.stringify(response),
    };
    process.env.ENV_QUIET || console.log(`onPOST.responseData: ${JSON.stringify(responseData, null, 2)}`);
    return responseData;
  }

  /**
   * @function onError
   * @description return 400 on error
   * @param {Error} e - error
   */
  async onError(e) {
    const responseData = {
      statusCode: 400,
      headers: this.getCORS(),
      body: JSON.stringify({
        Error: e.message,
      }),
    };
    process.env.ENV_QUIET || console.log(`onError.responseData = ${JSON.stringify(responseData, null, 2)}`);
    return responseData;
  }

  /* eslint-disable no-unused-vars */
  /**
   * @function onIngestStateMachine
   * @param {object} data
   * @param {DBConfig} config
   */
  static async onIngestStateMachine(data, config) {
    return new VideoAsset(data);
  }

  /**
   * @function onMetadataStateMachine
   * @param {object} data
   * @param {DBConfig} config
   */
  static async onMetadataStateMachine(data, config) {
    return new VideoAsset(data);
  }
  /* eslint-enable no-unused-vars */

  /**
   * @function onAttachIotPolicy
   * @description call Iot attach-policy to bind the identityId to Iot policy for the user
   */
  async onAttachIotPolicy() {
    try {
      const {
        requestContext: {
          identity,
        },
      } = this.event;

      const params = {
        policyName: process.env.ENV_IOT_THING_POLICY_NAME,
        target: identity.cognitoIdentityId,
      };
      process.env.ENV_QUIET || console.log(`onAttachIotPolicy.params = ${JSON.stringify(params, null, 2)}`);
      const iot = new AWS.Iot({
        apiVersion: '2015-05-28',
      });
      const response = await iot.attachPolicy(params).promise();

      process.env.ENV_QUIET || console.log(`onAttachIotPolicy.response = ${JSON.stringify(response, null, 2)}`);
      return response;
    } catch (e) {
      process.env.ENV_QUIET || console.error(e);
      throw e;
    }
  }

  /**
   * @function request
   * @description support OPTIONS, GET, POST methods
   */
  async request() {
    try {
      let responseData = null;
      switch (this.requestMethod) {
        case 'OPTIONS':
          responseData = await this.onOPTIONS();
          break;
        case 'GET':
          responseData = await this.onGET();
          break;
        case 'POST':
          responseData = await this.onPOST();
          break;
        default:
          throw new Error(`${this.requestMethod} not implemented`);
      }
      return responseData;
    } catch (e) {
      const responseError = await this.onError(e);
      return responseError;
    }
  }
}

module.exports = {
  ApiRequest,
};
