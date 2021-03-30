/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  ApiOps,
  CommonUtils,
} = require('core-lib');
const AnalysisOp = require('./operations/analysisOp');
const AssetOp = require('./operations/assetOp');
const LabelingOp = require('./operations/labelingOp');
const IotOp = require('./operations/iotOp');
const SearchOp = require('./operations/searchOp');
const StepOp = require('./operations/stepOp');
const WorkteamOp = require('./operations/workteamOp');
const FaceCollectionOp = require('./operations/faceCollectionOp');
const EditLabelOp = require('./operations/editLabelOp');
const RekognitionOp = require('./operations/rekognitionOp');
const TranscribeOp = require('./operations/transcribeOp');
const ComprehendOp = require('./operations/comprehendOp');
const StatsOp = require('./operations/statsOp');

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
    const op = this.pathParameters.operation;
    if (op === ApiOps.AttachPolicy) {
      return new IotOp(this);
    }
    if (op === ApiOps.Assets) {
      return new AssetOp(this);
    }
    if (op === ApiOps.Analysis) {
      return new AnalysisOp(this);
    }
    if (op === ApiOps.Search) {
      return new SearchOp(this);
    }
    if (op === ApiOps.Labeling) {
      return new LabelingOp(this);
    }
    if (op === ApiOps.Execution) {
      return new StepOp(this);
    }
    if (op === ApiOps.Workteam) {
      return new WorkteamOp(this);
    }
    if (op === ApiOps.IndexFace || op === ApiOps.QueueFace || op === ApiOps.FaceColection) {
      return new FaceCollectionOp(this);
    }
    if (op === ApiOps.EditLabel) {
      return new EditLabelOp(this);
    }
    if (op === ApiOps.FaceCollections.split('/').shift() || op === ApiOps.CustomLabelModels.split('/').shift()) {
      return new RekognitionOp(this);
    }
    if (op === ApiOps.CustomVocabularies.split('/').shift()) {
      return new TranscribeOp(this);
    }
    if (op === ApiOps.CustomLanguageModels.split('/').shift()) {
      return new TranscribeOp(this);
    }
    if (op === ApiOps.CustomEntityRecognizers.split('/').shift()) {
      return new ComprehendOp(this);
    }
    if (op === ApiOps.Stats) {
      return new StatsOp(this);
    }
    throw new Error(`operation '${(this.pathParameters || {}).operation}' not supported`);
  }
}

module.exports = ApiRequest;
