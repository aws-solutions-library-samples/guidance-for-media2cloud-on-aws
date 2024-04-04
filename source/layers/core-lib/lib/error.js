// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ServiceException,
} = require('@smithy/smithy-client');

/**
 * @class M2CException
 * @description Error code 999
 */
class M2CException extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'M2CException',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 999;
  }
}

/**
 * @class ConfigurationError
 * @description Error code 1000
 */
class ConfigurationError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'ConfigurationError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1000;
  }
}

/**
 * @class IngestError
 * @description Error code 1001
 */
class IngestError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'IngestError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1001;
  }
}

/**
 * @class AnalysisError
 * @description Error code 1002
 */
class AnalysisError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'AnalysisError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1002;
  }
}

/**
 * @class IndexError
 * @description Error code 1003
 */
class IndexError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'IndexError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1003;
  }
}

/**
 * @class ChecksumError
 * @description Error code 1004
 */
class ChecksumError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'ChecksumError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1004;
  }
}

/**
 * @class RestoreError
 * @description Error code 1005
 */
class RestoreError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'RestoreError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1005;
  }
}

/**
 * @class JobStatusError
 * @description Error code 1006
 */
class JobStatusError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'JobStatusError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1006;
  }
}

/**
 * @class GroundTruthError
 * @description Error code 1007
 */
class GroundTruthError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'GroundTruthError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1007;
  }
}

/**
 * @class TranscodeError
 * @description Error code 1008
 */
class TranscodeError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'TranscodeError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1008;
  }
}

/**
 * @class NotImplError
 * @description Error code 1009
 */
class NotImplError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'NotImplError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1009;
  }
}

/**
 * @class FixityError
 * @description Error code 1010
 */
class FixityError extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'FixityError',
      $metadata: {
        httpStatusCode: 400,
      },
    });
    this.errorCode = 1010;
  }
}

module.exports = {
  M2CException,
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
