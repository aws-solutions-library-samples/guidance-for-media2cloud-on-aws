/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const SQL = require('sqlstring');
const Environment = require('./lib/environment');
const AnalysisTypes = require('./lib/analysisTypes');
const AIML = require('./lib/aiml');
const StateData = require('./lib/stateData');
const StateMessage = require('./lib/stateMessage');
const DB = require('./lib/db');
const FaceCollection = require('./lib/faceCollection');
const IotStatus = require('./lib/iotStatus');
const ApiOps = require('./lib/apiOps');
const SNS = require('./lib/sns');
const Retry = require('./lib/retry');
const TimelineQ = require('./lib/timelineQ');
const WebVttCue = require('./lib/webVttCue');
const WebVttTrack = require('./lib/webVttTrack');
const Metrics = require('./lib/metrics');
const BaseIndex = require('./lib/baseIndex');
const ServiceAvailability = require('./lib/serviceAvailability');
const ServiceToken = require('./lib/serviceToken');
const Errors = require('./lib/error');
const EDLComposer = require('./lib/edlComposer');
const TimecodeUtils = require('./lib/timecodeUtils');
const TarStreamHelper = require('./lib/tarStreamHelper');
const FrameCaptureMode = require('./lib/frameCaptureMode');
const FrameCaptureModeHelper = require('./lib/frameCaptureModeHelper');
const StatsDB = require('./lib/statsDB');
const {
  mxCommonUtils,
  mxValidation,
  mxNeat,
} = require('./lib/mxCommonUtils');

class CommonUtils extends mxCommonUtils(mxValidation(mxNeat(class {}))) {}

module.exports = {
  Environment,
  AnalysisTypes,
  AIML,
  StateData,
  StateMessage,
  DB,
  CommonUtils,
  Retry,
  FaceCollection,
  IotStatus,
  ApiOps,
  SNS,
  ...Errors,
  TimelineQ,
  WebVttCue,
  WebVttTrack,
  Metrics,
  BaseIndex,
  ServiceAvailability,
  ServiceToken,
  SQL,
  EDLComposer,
  TimecodeUtils,
  TarStreamHelper,
  FrameCaptureMode,
  FrameCaptureModeHelper,
  StatsDB,
};
