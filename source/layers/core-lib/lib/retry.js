/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
class Retry {
  /**
   * @static
   * @function pause - execution for specified duration
   * @param {number} duration - in milliseconds
   */
  static async pause(duration = 0) {
    return new Promise(resolve =>
      setTimeout(() => resolve(), duration));
  }

  /**
   * @static
   * @function random
   * @param {number} [min] default to 0
   * @param {number} [max] default to 100
   */
  static random(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  /**
   * @static
   * @function run
   * @param {function} fn
   * @param {object} params
   * @param {number} [maxTries] maximum retries
   */
  static async run(fn, params, maxTries = 4) {
    let response;
    let tries = 0;

    do {
      try {
        response = await fn(params).promise();
      } catch (e) {
        if (e.code === 'ProvisionedThroughputExceededException' || e.code === 'ThrottlingException') {
          await Retry.pause(Retry.random(200, 800));
        } else {
          throw e;
        }
      }
    } while (tries++ < maxTries && response === undefined);

    return response;
  }
}

module.exports = Retry;
