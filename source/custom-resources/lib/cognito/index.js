// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const mxBaseResponse = require('../shared/mxBaseResponse');

const CUSTOM_USER_AGENT = process.env.ENV_CUSTOM_USER_AGENT;

class X0 extends mxBaseResponse(class {}) {}

/**
 * @function RegisterUser
 * @param {object} event
 * @param {object} context
 */
exports.RegisterUser = async (event, context) => {
  let x0;

  try {
    console.log(`event = ${JSON.stringify(event, null, 2)}`);

    x0 = new X0(event, context);
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const data = event.ResourceProperties.Data || {};
    if (!data.UserPoolId) {
      throw new M2CException('UserPoolId must be specified');
    }
    if (!data.Username || (!data.Email && !data.TemporaryCode)) {
      throw new M2CException('Username and Email or TemporarCode must be specified');
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
    const cognitoIdpClient = xraysdkHelper(new CognitoIdentityProviderClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new AdminCreateUserCommand(params);

    return cognitoIdpClient.send(command)
      .then(() => {
        x0.storeResponseData('Username', data.Username);
        x0.storeResponseData('Status', 'SUCCESS');
        return x0.responseData;
      });
  } catch (e) {
    console.error(
      'ERR:',
      'RegisterUser:',
      'AdminCreateUserCommand:',
      e.$metadata.httpStatusCode,
      e.name,
      e.message
    );

    x0.storeResponseData('Status', 'FAILED');
    return x0.responseData;
  }
};
