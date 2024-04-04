// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StandardRetryStrategy,
} = require('@smithy/util-retry');

const MAX_ATTEMPTS = 4;

function retryStrategyHelper(maxAttempt = MAX_ATTEMPTS) {
  const _maxAttempt = Math.max(1, maxAttempt);

  const maxAttemptProvider = async () =>
    _maxAttempt;

  const retryStrategyOptions = {};

  const retryStrategy = new StandardRetryStrategy(
    maxAttemptProvider,
    retryStrategyOptions
  );

  return retryStrategy;
}

module.exports = retryStrategyHelper;
