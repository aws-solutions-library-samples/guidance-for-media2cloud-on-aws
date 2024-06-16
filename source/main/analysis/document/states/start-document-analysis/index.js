// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const CRYPTO = require('crypto');

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  StateData,
  AnalysisTypes: {
    Textract,
  },
  AnalysisError,
  CommonUtils,
  Environment,
  ServiceToken,
} = require('core-lib');
const {
  BacklogClient: {
    TextractBacklogJob,
  },
} = require('service-backlog-lib');

class StateStartDocumentAnalysis {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
    this.$textract = new AWS.Textract({
      apiVersion: '2018-06-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
  }

  get [Symbol.toStringTag]() {
    return 'StateStartDocumentAnalysis';
  }

  get stateData() {
    return this.$stateData;
  }

  get textract() {
    return this.$textract;
  }

  makeParams() {
    const {
      uuid,
      input: {
        bucket,
        key,
        destination: {
          bucket: proxyBucket,
          prefix: proxyPrefix,
        },
        request: {
          timestamp,
        },
      },
    } = this.stateData;

    let randomId = CRYPTO.randomBytes(4).toString('hex');
    randomId = `${uuid}-${Textract}-${randomId}`;

    const _timestamp = CommonUtils.toISODateTime(timestamp);

    const _proxyPrefix = PATH.join(
      proxyPrefix,
      'raw',
      _timestamp,
      Textract
    );

    return {
      JobTag: randomId,
      DocumentLocation: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
      OutputConfig: {
        S3Bucket: proxyBucket,
        S3Prefix: _proxyPrefix,
      },
    };
  }

  async process() {
    const {
      enabled,
      prefix,
      numPages,
    } = this.stateData.input.document || {};

    if (!enabled || !prefix || !numPages) {
      throw new AnalysisError('bucket, document.prefix, or document.numPages not specified');
    }

    const params = this.makeParams();
    const id = params.JobTag;

    // start document analysis
    const textract = new TextractBacklogJob();
    await textract.startDocumentTextDetection(id, params);

    // store data in ddb for the next state when job completed
    if ((this.stateData.data || {})[Textract] === undefined) {
      this.stateData.data = {
        ...this.stateData.data,
        [Textract]: {},
      };
    }

    const data = this.stateData.data[Textract];
    data.backlogId = id;
    data.startTime = Date.now();
    // temporarily store output prefix
    data.jsonPrefix = params.OutputConfig.S3Prefix;

    const responseData = this.stateData.toJSON();

    // register state machine token
    const token = this.stateData.event.token;
    await ServiceToken.register(
      id,
      token,
      Textract,
      Textract,
      responseData
    );

    return responseData;
  }
}

module.exports = StateStartDocumentAnalysis;
