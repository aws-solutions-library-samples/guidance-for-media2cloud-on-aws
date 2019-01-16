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

/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */

/**
 * API Gateway BEGIN
 */
exports.OnRequest = async (event, context) => {
  const handler = require('./lib/api/index').onRequest;
  const response = await handler(event, context);
  return response;
};
/* API Gateway END */


/**
 * Ingest workflow BEGIN
 */
exports.OnMediaFileArrival = async (event, context) => {
  const handler = require('./lib/ingest/preprocess/index').onMediaFileArrival;
  const response = await handler(event, context);
  return response;
};

exports.OnGlacierObjectCreated = async (event, context) => {
  const handler = require('./lib/ingest/preprocess/index').onGlacierObjectCreated;
  const response = await handler(event, context);
  return response;
};

exports.GenerateMediaInfo = async (event, context) => {
  const handler = require('./lib/ingest/mediainfo/index').generateMediaInfo;
  const response = await handler(event, context);
  return response;
};

exports.StartTranscode = async (event, context) => {
  const handler = require('./lib/ingest/transcode/index').startTranscode;
  const response = await handler(event, context);
  return response;
};

exports.GetTranscodeStatus = async (event, context) => {
  const handler = require('./lib/ingest/transcode/index').getTranscodeStatus;
  const response = await handler(event, context);
  return response;
};

exports.OnIngestCompleted = async (event, context) => {
  const handler = require('./lib/ingest/postprocess/index').onIngestCompleted;
  const response = await handler(event, context);
  return response;
};

exports.OnIngestError = async (event, context) => {
  const handler = require('./lib/sns/index').send;
  const sent = await handler('OnIngestError', event);
  return sent;
};
/* Ingest workflow END */


/**
 * Metadata workflow BEGIN
 */
exports.CopyObjectForAnalytics = async (event, context) => {
  const handler = require('./lib/metadata/preprocess/index').copyObjectForAnalytics;
  const response = await handler(event, context);
  return response;
};

exports.StartAnalyticsStateMachine = async (event, context) => {
  const handler = require('./lib/metadata/analytics/index').startAnalyticsStateMachine;
  const response = await handler(event, context);
  return response;
};

exports.GetAnalyticsStateMachine = async (event, context) => {
  const handler = require('./lib/metadata/analytics/index').getAnalyticsStateMachine;
  const response = await handler(event, context);
  return response;
};

exports.CollectAnalyticsResults = async (event, context) => {
  const handler = require('./lib/metadata/analytics/index').collectAnalyticsResults;
  const response = await handler(event, context);
  return response;
};

exports.CreateWebVttTracks = async (event, context) => {
  const handler = require('./lib/metadata/vtt/index').createWebVttTracks;
  const response = await handler(event, context);
  return response;
};

exports.DispatchEvent = async (event, context) => {
  const handler = require('./lib/metadata/mam/index').dispatchEvent;
  const response = await handler(event, context);
  return response;
};

exports.OnMetadataError = async (event, context) => {
  const handler = require('./lib/sns/index').send;
  const sent = await handler('OnMetadataError', event);
  return sent;
};
/* Metadata workflow END */
