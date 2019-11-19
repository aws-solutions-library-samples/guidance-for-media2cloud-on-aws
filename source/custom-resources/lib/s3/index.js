/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */

/**
 * @function SetNotification
 * @param {object} event
 * @param {object} context
 */
exports.SetNotification = async (event, context) => {
  try {
    const {
      S3Notification,
    } = require('./s3ex');

    const instance = new S3Notification(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `SetNotification: ${e.message}`;
    throw e;
  }
};

/**
 * @function SetCORS
 * @param {object} event
 * @param {object} context
 */
exports.SetCORS = async (event, context) => {
  try {
    const {
      S3Cors,
    } = require('./s3ex');

    const instance = new S3Cors(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `SetCORS: ${e.message}`;
    throw e;
  }
};

/**
 * @function SetLifecyclePolicy
 * @param {object} event
 * @param {object} context
 */
exports.SetLifecyclePolicy = async (event, context) => {
  try {
    const {
      S3LifecyclePolicy,
    } = require('./s3ex');

    const instance = new S3LifecyclePolicy(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `SetLifecyclePolicy: ${e.message}`;
    throw e;
  }
};

/**
 * @function CheckBucketAvailability
 * @param {object} event
 * @param {object} context
 */
exports.CheckBucketAvailability = async (event, context) => {
  try {
    const {
      S3BucketAvailibility,
    } = require('./s3ex');

    const instance = new S3BucketAvailibility(event, context);

    const responseData = (instance.isRequestType('delete'))
      ? await instance.purge()
      : await instance.create();

    return responseData;
  } catch (e) {
    e.message = `S3BucketAvailibility: ${e.message}`;
    throw e;
  }
};
