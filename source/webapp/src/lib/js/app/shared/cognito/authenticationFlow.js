// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import SolutionManifest from '/solution-manifest.js';
import DateHelper from './dateHelper.js';
import AuthenticationHelper from './authenticationHelper.js';
import {
  CreateUserSessionFromAuth,
} from './userSession.js';

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AuthFlowType,
  ChallengeNameType,
} = window.AWSv3;

const REGION = SolutionManifest.Region;
const USERPOOL_ID = SolutionManifest.Cognito.UserPoolId;
const CLIENT_ID = SolutionManifest.Cognito.ClientId;

const _cognitoIdpClient = new CognitoIdentityProviderClient({
  region: REGION,
});

export default class AuthenticationFlow {
  constructor(
    userPoolId = USERPOOL_ID,
    clientId = CLIENT_ID,
    authFlow = AuthFlowType.USER_SRP_AUTH
  ) {
    this.$userPoolId = userPoolId;
    this.$clientId = clientId;
    this.$authFlow = authFlow;
    this.$currentUserSession = undefined;
    this.$authenticationHelper = new AuthenticationHelper(userPoolId);
  }

  get userPoolId() {
    return this.$userPoolId;
  }

  get clientId() {
    return this.$clientId;
  }

  get authFlow() {
    return this.$authFlow;
  }

  get authenticationHelper() {
    return this.$authenticationHelper;
  }

  get currentUserSession() {
    return this.$currentUserSession;
  }

  set currentUserSession(val) {
    this.$currentUserSession = val;
  }

  /* Support two flows: */
  /* authentication flow */
  /* reset password flow */
  /* return a user session object */
  async authenticateUser(
    username,
    password
  ) {
    let response;

    response = await this.initiateAuth(
      username,
      password
    );

    /* authentication is good */
    if (response.AuthenticationResult !== undefined) {
      this.currentUserSession = await CreateUserSessionFromAuth(
        response.AuthenticationResult
      );
      return this.currentUserSession;
    }

    /* password verification */
    if (response.ChallengeName === ChallengeNameType.PASSWORD_VERIFIER) {
      response = await this.authPasswordVerificationChallenge(response, password);

      console.log(
        ChallengeNameType.PASSWORD_VERIFIER,
        response
      );

      if (response.AuthenticationResult !== undefined) {
        this.currentUserSession = await CreateUserSessionFromAuth(
          response.AuthenticationResult
        );
        return this.currentUserSession;
      }
    }

    return response;
  }

  async newPasswordRequired(
    data,
    username,
    newPassword
  ) {
    let response;

    /* new password required */
    if (data.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
      response = await this.authNewPasswordChallenge(
        data,
        username,
        newPassword
      );

      console.log(
        ChallengeNameType.NEW_PASSWORD_REQUIRED,
        response
      );

      if (response.AuthenticationResult !== undefined) {
        this.currentUserSession = await CreateUserSessionFromAuth(
          response.AuthenticationResult
        );
        return this.currentUserSession;
      }
    }

    throw new Error('ERR: newPasswordRequired: fail to get AuthenticationResult');
  }

  async forgotPassword(
    username
  ) {
    const params = {
      ClientId: this.clientId,
      Username: username,
    };

    const command = new ForgotPasswordCommand(params);

    const response = await _cognitoIdpClient.send(command);
    console.log(
      'ForgotPasswordCommand',
      response
    );

    return response;
  }

  async makeAuthParams(username, password) {
    const params = {
      AuthFlow: this.authFlow,
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: username,
      },
    };

    if (params.AuthFlow === AuthFlowType.USER_PASSWORD_AUTH) {
      params.AuthParameters.PASSWORD = password;
    } else if (params.AuthFlow === AuthFlowType.USER_SRP_AUTH) {
      const srpA = await this.authenticationHelper.calculateA();
      params.AuthParameters.SRP_A = srpA.toString(16);
    } else {
      throw new Error('invalid authentication flow');
    }

    return params;
  }

  async initiateAuth(
    username,
    password
  ) {
    const params = await this.makeAuthParams(
      username,
      password
    );
    const command = new InitiateAuthCommand(params);
    const response = await _cognitoIdpClient.send(command);

    console.log(
      'InitiateAuthCommand',
      response
    );
    return response;
  }

  async authPasswordVerificationChallenge(
    data,
    password
  ) {
    const srpUserId = data.ChallengeParameters.USER_ID_FOR_SRP;
    const srpB = AuthenticationHelper.hex2BigInt(
      data.ChallengeParameters.SRP_B
    );
    const salt = AuthenticationHelper.hex2BigInt(
      data.ChallengeParameters.SALT
    );

    const hkdf = await this.authenticationHelper.computePasswordAuthenticationKey(
      srpUserId,
      password,
      srpB,
      salt
    );

    const secretBlock = data.ChallengeParameters.SECRET_BLOCK;
    const dateNow = new DateHelper().getNowString();
    const signature = this.authenticationHelper.passwordClaimSignature(
      hkdf,
      srpUserId,
      secretBlock,
      dateNow
    );

    const challengeResponses = {
      USERNAME: srpUserId,
      PASSWORD_CLAIM_SECRET_BLOCK: secretBlock,
      PASSWORD_CLAIM_SIGNATURE: signature,
      TIMESTAMP: dateNow,
    };

    const command = new RespondToAuthChallengeCommand({
      ChallengeName: data.ChallengeName,
      ClientId: this.clientId,
      ChallengeResponses: challengeResponses,
      Session: data.Session,
      ClientMetadata: {},
    });

    return _cognitoIdpClient.send(command);
  }

  async authNewPasswordChallenge(
    data,
    username,
    newPassword
  ) {
    console.log('data', data, 'newPassword', newPassword);

    const userAttributes = JSON.parse(
      data.ChallengeParameters.userAttributes
    );
    const requiredAttributes = JSON.parse(
      data.ChallengeParameters.requiredAttributes
    );

    const challengeResponses = {
      USERNAME: username,
      NEW_PASSWORD: newPassword,
    };

    const command = new RespondToAuthChallengeCommand({
      ChallengeName: data.ChallengeName,
      ClientId: this.clientId,
      ChallengeResponses: challengeResponses,
      Session: data.Session,
      ClientMetadata: {},
    });

    return _cognitoIdpClient.send(command);
  }

  async confirmPasswordChange(
    username,
    newPassword,
    confirmationCode
  ) {
    const params = {
      ClientId: this.clientId,
      Username: username,
      Password: newPassword,
      ConfirmationCode: confirmationCode,
    };

    const command = new ConfirmForgotPasswordCommand(params);

    const response = await _cognitoIdpClient.send(command);
    console.log('ConfirmForgotPasswordCommand', response);

    return response;
  }
}
