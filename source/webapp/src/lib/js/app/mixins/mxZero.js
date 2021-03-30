/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
/**
 * @mixins mxZero
 * @description helper functions to convert number to readable string
 */
const mxZero = Base => class extends Base {
  static zeroMd5() {
    return new Array(32).fill('0').join('');
  }

  static zeroUuid() {
    const uuid = new Array(36).fill('0');
    // eslint-disable-next-line
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    return uuid.join('');
  }

  static zeroAccountId() {
    return new Array(12).fill('0').join('');
  }
};
export default mxZero;
