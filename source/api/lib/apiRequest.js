/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const {
  ApiOps,
  CommonUtils,
} = require('m2c-core-lib');

const {
  AnalysisOp,
} = require('./operations/analysisOp');

const {
  AssetOp,
} = require('./operations/assetOp');

const {
  LabelingOp,
} = require('./operations/labelingOp');

const {
  IotOp,
} = require('./operations/iotOp');

const {
  SearchOp,
} = require('./operations/searchOp');

const {
  StepOp,
} = require('./operations/stepOp');

const {
  WorkteamOp,
} = require('./operations/workteamOp');

const {
  FaceCollectionOp,
} = require('./operations/faceCollectionOp');

const {
  EditLabelOp,
} = require('./operations/editLabelOp');

class ApiRequest {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;

    const {
      invokedFunctionArn,
    } = context;
    this.$accountId = invokedFunctionArn.split(':')[4];

    const identity = ((event.requestContext || {}).identity || {}).cognitoIdentityId
      || (event.queryStringParameters || {}).requester;

    this.$cognitoIdentityId = (identity)
      ? decodeURIComponent(identity)
      : undefined;

    if (this.$cognitoIdentityId
      && !CommonUtils.validateCognitoIdentityId(this.$cognitoIdentityId)) {
      throw new Error('invalid user id');
    }

    try {
      this.$body = JSON.parse(this.$event.body);
    } catch (e) {
      this.$body = this.$event.body;
    }
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

  get cognitoIdentityId() {
    return this.$cognitoIdentityId;
  }

  get method() {
    return this.event.httpMethod;
  }

  get path() {
    return this.event.path;
  }

  get headers() {
    return this.event.headers;
  }

  get queryString() {
    return this.event.queryStringParameters;
  }

  get pathParameters() {
    return this.event.pathParameters;
  }

  get body() {
    return this.$body;
  }

  getProcessor() {
    switch ((this.pathParameters || {}).operation) {
      case ApiOps.AttachPolicy:
        return new IotOp(this);
      case ApiOps.Assets:
        return new AssetOp(this);
      case ApiOps.Analysis:
        return new AnalysisOp(this);
      case ApiOps.Search:
        return new SearchOp(this);
      case ApiOps.Labeling:
        return new LabelingOp(this);
      case ApiOps.Execution:
        return new StepOp(this);
      case ApiOps.Workteam:
        return new WorkteamOp(this);
      case ApiOps.IndexFace:
      case ApiOps.QueueFace:
      case ApiOps.FaceColection:
        return new FaceCollectionOp(this);
      case ApiOps.EditLabel:
        return new EditLabelOp(this);
      default:
        throw new Error(`operation '${(this.pathParameters || {}).operation}' not supported`);
    }
  }
}

module.exports = {
  ApiRequest,
};
