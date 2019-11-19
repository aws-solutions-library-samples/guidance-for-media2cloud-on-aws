/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable global-require */
const {
  CognitoIdentityServiceProvider,
} = require('aws-sdk');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

/**
 * @function RegisterUser
 * @param {object} event
 * @param {object} context
 */
exports.RegisterUser = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}`);

  class X0 extends mxBaseResponse(class {}) {}
  const x0 = new X0(event, context);

  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const {
      ResourceProperties = {},
    } = event || {};

    const {
      UserPoolId,
      Email,
    } = ResourceProperties || {};

    const Username = Email.split('@').shift();

    const instance = new CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18',
    });

    await instance.adminCreateUser({
      UserPoolId,
      Username,
      DesiredDeliveryMediums: [
        'EMAIL',
      ],
      UserAttributes: [
        {
          Name: 'email',
          Value: Email,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        },
      ],
    }).promise();

    x0.storeResponseData('Username', Username);
    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `RegisterUser: ${e.message}`;
    console.error(e);
    x0.storeResponseData('Status', 'FAILED');

    return x0.responseData;
  }
};


/**
 * @function Presignup
 * @param {object} event
 * @param {object} context
 */
exports.Presignup = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)}`);

  class X0 extends mxBaseResponse(class {}) {}
  const x0 = new X0(event, context);

  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const {
      ResourceProperties = {},
    } = event || {};

    const {
      UserPoolId,
      Username,
    } = ResourceProperties || {};

    const instance = new CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18',
    });

    await instance.adminUpdateUserAttributes({
      UserPoolId,
      Username,
      UserAttributes: [
        {
          Name: 'email_verified',
          Value: 'true',
        },
      ],
    }).promise();

    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `Presignup: ${e.message}`;
    console.error(e);
    x0.storeResponseData('Status', 'FAILED');

    return x0.responseData;
  }
};
