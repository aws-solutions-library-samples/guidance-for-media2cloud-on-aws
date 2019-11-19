/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable operator-linebreak */
const Statuses = {
  None: 'NONE',
  NotStarted: 'NOT_STARTED',
  Started: 'STARTED',
  InProgress: 'IN_PROGRESS',
  Completed: 'COMPLETED',
  Error: 'ERROR',
  NoData: 'NO_DATA',
  Removed: 'REMOVED',
};

module.exports = {
  Statuses,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    Statuses,
  });
