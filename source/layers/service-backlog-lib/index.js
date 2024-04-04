// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const BacklogTable = require('./lib/backlog-table');
const BacklogTableStream = require('./lib/backlog-table-stream');
const BacklogJob = require('./lib/client/backlogJob');
const BacklogEBHelper = require('./lib/shared/ebHelper');
const ComprehendBacklogJob = require('./lib/client/comprehend');
const MediaConvertBacklogJob = require('./lib/client/mediaconvert');
const RekognitionBacklogJob = require('./lib/client/rekognition');
const TextractBacklogJob = require('./lib/client/textract');
const TranscribeBacklogJob = require('./lib/client/transcribe');
const CustomBacklogJob = require('./lib/client/custom');
const AtomicLockTable = require('./lib/atomic-lock-table');
const Environment = require('./lib/shared/defs');
const xraysdkHelper = require('./lib/shared/xraysdkHelper');
const retryStrategyHelper = require('./lib/shared/retryStrategyHelper');
const Errors = require('./lib/shared/error');

module.exports = {
  BacklogTable,
  BacklogTableStream,
  BacklogJob,
  BacklogEBHelper,
  BacklogClient: {
    ComprehendBacklogJob,
    MediaConvertBacklogJob,
    RekognitionBacklogJob,
    TextractBacklogJob,
    TranscribeBacklogJob,
    CustomBacklogJob,
  },
  AtomicLockTable,
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
  ...Errors,
};
