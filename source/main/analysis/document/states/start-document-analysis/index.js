// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const CRYPTO = require('node:crypto');
const {
  StateData,
  AnalysisTypes: {
    Textract,
  },
  AnalysisError,
  ServiceToken,
  CommonUtils,
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
  }

  get [Symbol.toStringTag]() {
    return 'StateStartDocumentAnalysis';
  }

  get stateData() {
    return this.$stateData;
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
