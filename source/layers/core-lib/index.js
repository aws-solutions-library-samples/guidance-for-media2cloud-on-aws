// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AdmZip = require('adm-zip');
const NodeWebVtt = require('node-webvtt');
const CSVParser = require('csv-parser');
const Environment = require('./lib/environment');
const AnalysisTypes = require('./lib/analysisTypes');
const {
  AIML,
  aimlGetPresets,
} = require('./lib/aiml');
const StateData = require('./lib/stateData');
const StateMessage = require('./lib/stateMessage');
const DB = require('./lib/db');
const IotStatus = require('./lib/iotStatus');
const ApiOps = require('./lib/apiOps');
const SNS = require('./lib/sns');
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
const WhitelistLabels = require('./lib/whitelistLabels');
const CommonUtils = require('./lib/commonUtils');
const ValidationHelper = require('./lib/validationHelper');
const MimeTypeHelper = require('./lib/mimeTypeHelper');
const WebVttHelper = require('./lib/webVttHelper');
const xraysdkHelper = require('./lib/xraysdkHelper');
const retryStrategyHelper = require('./lib/retryStrategyHelper');
const GraphDefs = require('./lib/graphDefs');
const FaceIndexer = require('./lib/faceIndexer');
const FaceIndexerDefs = require('./lib/faceIndexer/defs');
const IABTaxonomy = require('./lib/iabTaxonomyV3');
const JimpHelper = require('./lib/jimpHelper');

const MapDataVersion = 2;

module.exports = {
  // export third party packages
  AdmZip,
  NodeWebVtt,
  CSVParser,
  //
  Environment,
  AnalysisTypes,
  AIML,
  aimlGetPresets,
  StateData,
  StateMessage,
  DB,
  CommonUtils,
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
  EDLComposer,
  TimecodeUtils,
  TarStreamHelper,
  FrameCaptureMode,
  FrameCaptureModeHelper,
  Indexer,
  WhitelistLabels,
  MapDataVersion,
  ValidationHelper,
  MimeTypeHelper,
  WebVttHelper,
  xraysdkHelper,
  retryStrategyHelper,
  GraphDefs,
  FaceIndexer,
  FaceIndexerDefs,
  IABTaxonomy,
  JimpHelper,
};
