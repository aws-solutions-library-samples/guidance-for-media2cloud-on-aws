// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  isClockSkewError,
  isRetryableByTrait,
  isThrottlingError,
  isTransientError,
} = require('@smithy/service-error-classification');
const CRYPTO = require('crypto');
const CustomRetryQuota = require('./customRetryQuota');

const MAX_ATTEMPTS = 10;

function randomizeDelay(min, max) {
  return CRYPTO.randomInt(
    Math.max(0, min),
    Math.max(100, max)
  );
}

class CustomRetryStrategyOptions {
  constructor(
    maxAttempts = MAX_ATTEMPTS,
    retryErrors = undefined,
    minDelay = 200,
    maxDelay = 800
  ) {
    this.$maxAttempts = maxAttempts;
    this.$retryErrors = retryErrors;
    this.$retryQuota = new CustomRetryQuota(maxAttempts);
    this.$minDelay = Math.max(100, minDelay);
    this.$maxDelay = maxDelay;
    if (maxDelay <= minDelay) {
      this.$maxDelay = minDelay + 400;
    }
  }

  get maxAttempts() {
    return this.$maxAttempts;
  }

  get retryErrors() {
    return this.$retryErrors;
  }

  get retryQuota() {
    return this.$retryQuota;
  }

  get minDelay() {
    return this.$minDelay;
  }

  get maxDelay() {
    return this.$maxDelay;
  }

  delayDecider(delayBase, attempts) {
    const delay = randomizeDelay(
      this.mindDelay,
      this.maxDelay
    );

    return delay;
  }

  retryDecider(e) {
    if (!e) {
      return false;
    }

    if (Array.isArray(this.retryErrors)) {
      return this.retryErrors.includes(e.name);
    }

    return isRetryableByTrait(e)
      || isClockSkewError(e)
      || isThrottlingError(e)
      || isTransientError(e);
  }

  async maxAttemptProvider() {
    return this.maxAttempts;
  }

  getRetryStrategyOptions() {
    return {
      delayDecider: this.delayDecider.bind(this),
      retryDecider: this.retryDecider.bind(this),
      retryQuota: this.retryQuota,
    };
  }

  getMaxAttempProvider() {
    return this.maxAttemptProvider.bind(this);
  }
}

module.exports = CustomRetryStrategyOptions;
