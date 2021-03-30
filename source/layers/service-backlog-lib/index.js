// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
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
const Retry = require('./lib/shared/retry');
const Environment = require('./lib/shared/defs');

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
  Retry,
  Environment,
};
