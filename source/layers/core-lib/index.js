// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const SQL = require('sqlstring');
const AdmZip = require('adm-zip');
const NodeWebVtt = require('node-webvtt');
const Environment = require('./lib/environment');
const AnalysisTypes = require('./lib/analysisTypes');
const AIML = require('./lib/aiml');
const StateData = require('./lib/stateData');
const StateMessage = require('./lib/stateMessage');
const DB = require('./lib/db');
const IotStatus = require('./lib/iotStatus');
const ApiOps = require('./lib/apiOps');
const SNS = require('./lib/sns');
const Retry = require('./lib/retry');
const TimelineQ = require('./lib/timelineQ');
const WebVttCue = require('./lib/webVttCue');
const WebVttTrack = require('./lib/webVttTrack');
const Metrics = require('./lib/metrics');
const ServiceAvailability = require('./lib/serviceAvailability');
const ServiceToken = require('./lib/serviceToken');
const Errors = require('./lib/error');
const EDLComposer = require('./lib/edlComposer');
const TimecodeUtils = require('./lib/timecodeUtils');
const TarStreamHelper = require('./lib/tarStreamHelper');
const FrameCaptureMode = require('./lib/frameCaptureMode');
const FrameCaptureModeHelper = require('./lib/frameCaptureModeHelper');
const Indexer = require('./lib/indexer');
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
  IotStatus,
  ApiOps,
  SNS,
  ...Errors,
  TimelineQ,
  WebVttCue,
  WebVttTrack,
  Metrics,
  ServiceAvailability,
  ServiceToken,
  SQL,
  EDLComposer,
  TimecodeUtils,
  TarStreamHelper,
  FrameCaptureMode,
  FrameCaptureModeHelper,
  AdmZip,
  Indexer,
  NodeWebVtt,
};
