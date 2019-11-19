/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/**
 * @description shared library to expose classes
 */
const {
  Solution,
  Environment,
} = require('./lib/index');

const {
  AIML,
} = require('./lib/aiml');

const {
  StateData,
} = require('./lib/stateData');

const {
  StateMessage,
} = require('./lib/stateMessage');

const {
  DB,
  DBError,
} = require('./lib/db');

const {
  FaceCollection,
} = require('./lib/faceCollection');

const {
  IotStatus,
} = require('./lib/iotStatus');

const ApiOps = require('./lib/apiOps');

const SNS = require('./lib/sns');

const {
  Retry,
} = require('./lib/retry');

const {
  IndexError,
  IngestError,
  AnalysisError,
} = require('./lib/error');

const {
  BaseAnalysis,
} = require('./lib/baseAnalysis');

const {
  WebVttCue,
} = require('./lib/webVttCue');

const {
  WebVttTrack,
} = require('./lib/webVttTrack');

const {
  Metrics,
} = require('./lib/metrics');

const {
  BaseIndex,
} = require('./lib/baseIndex');

const {
  ServiceAvailability,
} = require('./lib/serviceAvailability');

const {
  mxCommonUtils,
  mxValidation,
  mxNeat,
} = require('./lib/mxCommonUtils');

class CommonUtils extends mxCommonUtils(mxValidation(mxNeat(class {}))) {}

module.exports = {
  /* solution */
  Solution,
  /* environment variables */
  Environment,
  /* AI/ML */
  AIML,
  /* state */
  StateData,
  StateMessage,
  /* dynamodb */
  DB,
  DBError,
  /* Helper classes */
  CommonUtils,
  Retry,
  /* face collection */
  FaceCollection,
  /* Iot */
  IotStatus,
  /* ApiOps */
  ApiOps,
  /* Sns */
  SNS,
  /* Error class */
  IndexError,
  IngestError,
  AnalysisError,
  /* base analysis */
  BaseAnalysis,
  WebVttCue,
  WebVttTrack,
  /* metrics */
  Metrics,
  /* elasticsearch indexer */
  BaseIndex,
  /* service availability helper */
  ServiceAvailability,
};
