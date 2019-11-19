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
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */

const {
  Iot,
} = require('aws-sdk');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

/**
 * @function IotEndpoint
 * @param {object} event
 * @param {object} context
 */
exports.IotEndpoint = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const instance = new Iot({
      apiVersion: '2015-05-28',
    });

    const response = await instance.describeEndpoint({
      endpointType: 'iot:Data-ATS',
    }).promise();

    if (!response || !response.endpointAddress) {
      throw new Error('fail to get Iot endpoint');
    }

    x0.storeResponseData('Endpoint', response.endpointAddress);
    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `IotEndpoint: ${e.message}`;
    throw e;
  }
};

/**
 * @function IotDetachPolices
 * @param {object} event
 * @param {object} context
 */
exports.IotDetachPolices = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Create')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const {
      ResourceProperties = {},
    } = event || {};

    const {
      IotThingPolicy,
    } = ResourceProperties;

    if (!IotThingPolicy) {
      console.error('missing event.ResourceProperties.IotThingPolicy. skipping...');

      x0.storeResponseData('Status', 'SKIPPED');

      return x0.responseData;
    }

    /* TODO: could have more than 200 targets! */
    const params = {
      policyName: IotThingPolicy,
      pageSize: 200,
    };

    const instance = new Iot({
      apiVersion: '2015-05-28',
    });

    const {
      targets = [],
    } = await instance.listTargetsForPolicy(params).promise();

    console.log(JSON.stringify(targets, null, 2));

    const promises = targets.map(target =>
      instance.detachPolicy({
        policyName: IotThingPolicy,
        target,
      }).promise());

    const response = await Promise.all(promises);

    console.log(JSON.stringify(response, null, 2));

    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `IotDetachPolices: ${e.message}`;
    throw e;
  }
};
