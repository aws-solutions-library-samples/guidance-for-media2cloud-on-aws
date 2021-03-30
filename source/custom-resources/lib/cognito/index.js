/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */
const AWS = require('aws-sdk');
const mxBaseResponse = require('../shared/mxBaseResponse');

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
      UserPoolId,
      Email,
    } = event.ResourceProperties.Data;
    const Username = Email.split('@').shift();
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18',
    });

    await cognito.adminCreateUser({
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
