/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */


/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */

const {
  Statuses,
} = require('./statuses');

/**
 * @class ErrorHandler
 * @description manage state machine error
 */
class ErrorHandler {
  /**
   * @static
   * @function format
   * @description format error message from state machine
   * @param {Object} info - state machine information
   * @param {Error} e - original Error object
   */
  static format(info, e) {
    e.message = JSON.stringify(Object.assign(info, {
      status: Statuses.Error,
      errorMessage: e.message,
    }));
    return e;
  }

  /**
   * @static
   * @function parse
   * @description parse error message from state machine
   * @param {Object} event - error object from state machine
   */
  static parse(event) {
    try {
      const parsed = JSON.parse(event.Cause);
      return JSON.parse(parsed.errorMessage);
    } catch (e) {
      return event;
    }
  }
}

module.exports = {
  ErrorHandler,
};
