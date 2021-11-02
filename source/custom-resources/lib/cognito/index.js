// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
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

    const data = event.ResourceProperties.Data || {};
    if (!data.UserPoolId) {
      throw new Error('UserPoolId must be specified');
    }
    if (!data.Username || (!data.Email && !data.TemporaryCode)) {
      throw new Error('Username and Email or TemporarCode must be specified');
    }
    let params = {
      UserPoolId: data.UserPoolId,
      Username: data.Username,
    };
    if (data.TemporaryCode) {
      params = {
        ...params,
        TemporaryPassword: data.TemporaryCode,
      };
    }
    if (data.Email) {
      params = {
        ...params,
        DesiredDeliveryMediums: [
          'EMAIL',
        ],
        UserAttributes: [
          {
            Name: 'email',
            Value: data.Email,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
      };
    }
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18',
      customUserAgent: process.env.ENV_CUSTOM_USER_AGENT,
    });
    await cognito.adminCreateUser(params).promise()
      .catch((e) => {
        console.error(`[ERR]: cognito.adminCreateUser: ${e.code} ${e.message} ${JSON.stringify(params, null, 2)}`);
        throw e;
      });
    x0.storeResponseData('Username', data.Username);
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `RegisterUser: ${e.message}`;
    console.error(e);
    x0.storeResponseData('Status', 'FAILED');
    return x0.responseData;
  }
};
