// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

class CustomRetryQuota {
  constructor(availCapacity = 10) {
    this.$availCapacity = availCapacity;
  }

  hasRetryTokens(error) {
    return (this.$availCapacity > 0);
  }

  retrieveRetryTokens(error) {
    this.$availCapacity -= 1;
    return this.$availCapacity;
  }

  releaseRetryTokens(capacityReleaseAmount) {
    this.$availCapacity += 1;
  }
}

module.exports = CustomRetryQuota;
