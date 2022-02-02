// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  /* overallStatus */
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Error: 'ERROR',
  /* internal state status */
  None: 'NONE',
  NotStarted: 'NOT_STARTED',
  Started: 'STARTED',
  InProgress: 'IN_PROGRESS',
  NoData: 'NO_DATA',
  Removed: 'REMOVED',
  /* status (workflow) */
  IngestStarted: 'INGEST_STARTED',
  IngestCompleted: 'INGEST_COMPLETED',
  IngestError: 'INGEST_ERROR',
  AnalysisStarted: 'ANALYSIS_STARTED',
  AnalysisCompleted: 'ANALYSIS_COMPLETED',
  AnalysisError: 'ANALYSIS_ERROR',
};
