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

module.exports = {
  M2CException,
};
