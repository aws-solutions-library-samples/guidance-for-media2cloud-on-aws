// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
class Retry {
  static get RetryExceptions() {
    return [
      /* rekognition */
      'ProvisionedThroughputExceededException',
      /* dynamodb */
      'RequestLimitExceeded',
      /* dynamodb */
      'TransactionConflictException',
      'ThrottlingException',
      'InternalServerError',
    ];
  }

  static async pause(duration = 0) {
    return new Promise(resolve =>
      setTimeout(() => resolve(), duration));
  }

  static async run(fn, params, maxTries = 4) {
    let response;
    let tries = 0;
    do {
      response = fn(params);
      if (typeof response.promise === 'function') {
        response = response.promise();
      }
      response = await response.catch(e => e);
      if (response instanceof Error) {
        if (Retry.RetryExceptions.indexOf(response.code) < 0) {
          /* exceptions we intentionally don't retry */
          break;
        }
        await Retry.pause(Math.ceil(400 * (1.5 ** tries)));
      }
    } while (tries++ < maxTries && (response instanceof Error));
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }
}

module.exports = Retry;
