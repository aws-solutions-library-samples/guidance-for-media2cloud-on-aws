// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

/**
 * @class ConfigurationError
 * @description Error code 1000
 */
class ConfigurationError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1000;
    this.message = `${this.errorCode} - ${this.message || 'configuration error'}`;
    Error.captureStackTrace(this, ConfigurationError);
  }
}

/**
 * @class IngestError
 * @description Error code 1001
 */
class IngestError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1001;
    this.message = `${this.errorCode} - ${this.message || 'unknown ingest error'}`;
    Error.captureStackTrace(this, IngestError);
  }
}

/**
 * @class AnalysisError
 * @description Error code 1002
 */
class AnalysisError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1002;
    this.message = `${this.errorCode} - ${this.message || 'unknown analysis error'}`;
    Error.captureStackTrace(this, AnalysisError);
  }
}

/**
 * @class IndexError
 * @description Error code 1003
 */
class IndexError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1003;
    this.message = `${this.errorCode} - ${this.message || 'unknown index error'}`;
    Error.captureStackTrace(this, IndexError);
  }
}

/**
 * @class ChecksumError
 * @description Error code 1004
 */
class ChecksumError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1004;
    this.message = `${this.errorCode} - ${this.message || 'unknown checksum error'}`;
    Error.captureStackTrace(this, ChecksumError);
  }
}

/**
 * @class RestoreError
 * @description Error code 1005
 */
class RestoreError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1005;
    this.message = `${this.errorCode} - ${this.message || 'unknown restore error'}`;
    Error.captureStackTrace(this, RestoreError);
  }
}

/**
 * @class JobStatusError
 * @description Error code 1006
 */
class JobStatusError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1006;
    this.message = `${this.errorCode} - ${this.message || 'unknown job status error'}`;
    Error.captureStackTrace(this, JobStatusError);
  }
}

/**
 * @class GroundTruthError
 * @description Error code 1007
 */
class GroundTruthError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1007;
    this.message = `${this.errorCode} - ${this.message || 'unknown ground truth error'}`;
    Error.captureStackTrace(this, GroundTruthError);
  }
}

/**
 * @class TranscodeError
 * @description Error code 1008
 */
class TranscodeError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1008;
    this.message = `${this.errorCode} - ${this.message || 'unknown transcode error'}`;
    Error.captureStackTrace(this, TranscodeError);
  }
}

/**
 * @class NotImplError
 * @description Error code 1009
 */
class NotImplError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1009;
    this.message = `${this.errorCode} - ${this.message || 'not impl'}`;
    Error.captureStackTrace(this, NotImplError);
  }
}

/**
 * @class FixityError
 * @description Error code 1010
 */
class FixityError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    this.errorCode = 1010;
    this.message = `${this.errorCode} - ${this.message || 'unknown fixity error'}`;
    Error.captureStackTrace(this, FixityError);
  }
}

module.exports = {
  ConfigurationError,
  IngestError,
  AnalysisError,
  IndexError,
  ChecksumError,
  RestoreError,
  JobStatusError,
  GroundTruthError,
  TranscodeError,
  NotImplError,
  FixityError,
};
