/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */


/**
 * @author MediaEnt Solutions
 */

/**
 * @class IngestError
 */
class IngestError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, IngestError);
  }
}

/**
 * @class AnalysisError
 */
class AnalysisError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, AnalysisError);
  }
}

/**
 * @class IndexError
 */
class IndexError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, IndexError);
  }
}

/**
 * @class ChecksumError
 */
class ChecksumError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, ChecksumError);
  }
}

/**
 * @class RestoreError
 */
class RestoreError extends Error {
  constructor(...args) {
    super(...args);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, RestoreError);
  }
}

module.exports = {
  IngestError,
  AnalysisError,
  IndexError,
  ChecksumError,
  RestoreError,
};
