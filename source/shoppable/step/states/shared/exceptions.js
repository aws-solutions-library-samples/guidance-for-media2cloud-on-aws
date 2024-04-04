// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  ServiceException,
} = require('@smithy/smithy-client');

/**
 * @class FeatureNotEnabledException
 * @description Error code 403
 */
class FeatureNotEnabledException extends ServiceException {
  constructor(message) {
    super({
      message,
      name: 'FeatureNotEnabledException',
      $metadata: {
        httpStatusCode: 403,
      },
    });
  }
}

module.exports = {
  FeatureNotEnabledException,
};
