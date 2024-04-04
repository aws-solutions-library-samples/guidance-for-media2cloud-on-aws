// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ServiceException,
} = require('@smithy/smithy-client');

/**
 * @class MethodNotAllowedException
 * @description Error code 403
 */
class MethodNotAllowedException extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'MethodNotAllowedException',
      $metadata: {
        httpStatusCode: 403,
      },
    });
  }
}

/**
 * @class InternalServerErrorException
 * @description Error code 500
 */
class InternalServerErrorException extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'InternalServerErrorException',
      $metadata: {
        httpStatusCode: 500,
      },
    });
  }
}

module.exports = {
  MethodNotAllowedException,
  InternalServerErrorException,
};
