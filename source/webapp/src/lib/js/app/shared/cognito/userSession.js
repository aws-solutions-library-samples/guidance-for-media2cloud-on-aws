// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import JwtToken from './jwToken.js';
import AppUtils from '../appUtils.js';
import {
  GetSettingStore,
} from '../localCache/settingStore.js';

const {
  CognitoIdentityProviderClient,
  AuthFlowType,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} = window.AWSv3;

const REGION = SolutionManifest.Region;
const CLIENT_ID = SolutionManifest.Cognito.ClientId;
const IDENTITYPOOL_ID = SolutionManifest.Cognito.IdentityPoolId;
const GROUP_VIEWER = SolutionManifest.Cognito.Group.Viewer;
const GROUP_CREATOR = SolutionManifest.Cognito.Group.Creator;
const GROUP_ADMIN = SolutionManifest.Cognito.Group.Admin;
const GROUP_CAN_WRITE = [
  GROUP_CREATOR,
  GROUP_ADMIN,
];
const GROUP_CAN_MODIFY = [
  GROUP_ADMIN,
];
const ATTR_COGNITO_GROUP = 'cognito:groups';

const SESSION_SIGNIN = 'session:signin';
const SESSION_SIGNOUT = 'session:signout';
const SESSION_TOKEN_REFRESHED = 'session:token:refreshed';

const OPT_USERNAME = 'cognito.username';
const OPT_REFRESH_TOKEN = 'cognito.refreshtoken';

/* singleton implementation */
let _singleton;

/* receive update event on credential change */
const _receivers = {};

const _onUserSessionChangeEvent = (event, data) => {
  setTimeout(async () => {
    const names = Object.keys(_receivers);
    try {
      await Promise.all(
        names.map((name) =>
          _receivers[name](event, data)
            .catch((e) => {
              console.error(
                'ERR:',
                `_onUserSessionChangeEvent.${name}:`,
                e.message
              );
              return undefined;
            }))
      );

      console.log(
        'INFO:',
        `_onUserSessionChangeEvent.${event}:`,
        `${names.length} receivers:`,
        names.join(', ')
      );
    } catch (e) {
      console.error(
        'ERR:',
        `_onUserSessionChangeEvent.${event}:`,
        e
      );
    }
  }, 10);
};

const _cognitoIdpClient = new CognitoIdentityProviderClient({
  region: REGION,
});

class UserSession {
  constructor(authenticationResult) {
    this.reinitialize(authenticationResult);

    this.$id = AppUtils.randomHexstring();
    _singleton = this;
  }

  reinitialize(authenticationResult) {
    this.$accessToken = undefined;
    this.$idToken = undefined;
    this.$expiresIn = undefined;
    this.$tokenType = undefined;
    this.$newDeviceMetadata = undefined;
    this.$identityId = undefined;
    this.$credentials = undefined;
    /* refreshToken is not available when performing REFRESH_TOKEN_AUTH flow */
    /* do not update when it is valid */
    if ((authenticationResult || {}).RefreshToken) {
      this.$refreshToken = new JwtToken(authenticationResult.RefreshToken);
    }
    if (this.$refreshTimer && this.$refreshTimer > 0) {
      clearTimeout(this.$refreshTimer);
    }
    this.$refreshTimer = -1;

    if (authenticationResult !== undefined) {
      this.$accessToken = new JwtToken(authenticationResult.AccessToken);
      this.$idToken = new JwtToken(authenticationResult.IdToken);
      this.$expiresIn = Number(authenticationResult.ExpiresIn);
      this.$tokenType = authenticationResult.TokenType;
      this.$newDeviceMetadata = authenticationResult.NewDeviceMetadata;
    }
  }

  get id() {
    return this.$id;
  }

  get accessToken() {
    return this.$accessToken;
  }

  get idToken() {
    return this.$idToken;
  }

  get refreshToken() {
    return this.$refreshToken;
  }

  get expiresIn() {
    return this.$expiresIn;
  }

  get tokenType() {
    return this.$tokenType;
  }

  get newDeviceMetadata() {
    return this.$newDeviceMetadata;
  }

  get identityId() {
    return this.$identityId;
  }

  set identityId(val) {
    this.$identityId = val;
  }

  get credentials() {
    return this.$credentials;
  }

  set credentials(val) {
    this.$credentials = val;
  }

  get refreshTimer() {
    return this.$refreshTimer;
  }

  set refreshTimer(val) {
    this.$refreshTimer = val;
  }

  get username() {
    return ((this.accessToken || {}).payload || {}).username;
  }

  get email() {
    return ((this.idToken || {}).payload || {}).email;
  }

  get assignedGroup() {
    return (((this.accessToken || {}).payload || {})[ATTR_COGNITO_GROUP] || [])[0];
  }

  canRead() {
    return this.assignedGroup !== undefined;
  }

  canWrite() {
    return GROUP_CAN_WRITE
      .indexOf(this.assignedGroup) >= 0;
  }

  canModify() {
    return GROUP_CAN_MODIFY
      .indexOf(this.assignedGroup) >= 0;
  }

  getAccessToken() {
    return (this.accessToken || {}).token;
  }

  getIdToken() {
    return (this.idToken || {}).token;
  }

  getRefreshToken() {
    return (this.refreshToken || {}).token;
  }

  sessionIsValid() {
    return this.credentials !== undefined;
  }

  async signIn() {
    try {
      await this.getCredentials(true);

      this.startRefreshTimer(this.credentials.Expiration);

      _onUserSessionChangeEvent(
        SESSION_SIGNIN,
        this
      );

      return this.credentials;
    } catch (e) {
      this.credentials = undefined;
      throw e;
    }
  }

  async signOut() {
    try {
      this.stopRefreshTimer();

      const store = GetSettingStore();

      await Promise.all([
        OPT_REFRESH_TOKEN,
      ].map((key) =>
        store.deleteItem(key)));

      _onUserSessionChangeEvent(
        SESSION_SIGNOUT,
        this
      );

      const accessToken = this.accessToken;
      const params = {
        AccessToken: accessToken,
      };

      const command = new GlobalSignOutCommand(params);
      const response = await _cognitoIdpClient.send(command);

      console.log(
        'GlobalSignOutCommand',
        response
      );

      return response;
    } catch (e) {
      console.log(
        'ERR:',
        'UserSession.signOut:',
        'GlobalSignOutCommand',
        e.$metadata.httpStatusCode,
        e.name,
        e.message
      );
      return undefined;
    } finally {
      this.reinitialize();
    }
  }

  async getCredentials(forceRefresh = false) {
    let command;
    let response;

    if (forceRefresh) {
      this.credentials = undefined;
      this.identityId = undefined;
    }

    if (this.credentials !== undefined) {
      return this.credentials;
    }

    const client = new CognitoIdentityClient({
      region: REGION,
    });

    let endpoint = new URL(this.idToken.payload.iss);
    endpoint = [
      endpoint.hostname,
      endpoint.pathname,
    ].join('');

    const logins = {
      [endpoint]: this.idToken.token,
    };

    if (this.identityId === undefined) {
      command = new GetIdCommand({
        IdentityPoolId: IDENTITYPOOL_ID,
        Logins: logins,
      });

      response = await client.send(command);
      console.log(
        'GetIdCommand',
        response
      );

      this.identityId = response.IdentityId;
    }

    if (this.identityId) {
      command = new GetCredentialsForIdentityCommand({
        IdentityId: response.IdentityId,
        Logins: logins,
      });

      response = await client.send(command);
      console.log(
        'GetCredentialsForIdentityCommand',
        response
      );

      this.credentials = response.Credentials;
    }

    return this.credentials;
  }

  async update(authenticationResult) {
    this.reinitialize(authenticationResult);

    /* force to sign in to update credentials */
    if (authenticationResult !== undefined) {
      return this.signIn();
    }

    return undefined;
  }

  startRefreshTimer(expiration) {
    this.stopRefreshTimer();

    const expiredAt = new Date(expiration);
    const current = new Date();
    const duration = Math.floor(expiredAt - current - (5 * 60 * 1000));

    console.log(
      'Schedule refresh in',
      Math.floor(duration / 1000),
      'secs'
    );

    if (duration > 0) {
      this.refreshTimer = setTimeout(async () => {
        await this.refreshTokenAuth();

        this.startRefreshTimer(this.credentials.Expiration);

        _onUserSessionChangeEvent(
          SESSION_TOKEN_REFRESHED,
          this
        );
      }, duration);
    }
  }

  stopRefreshTimer() {
    if (this.refreshTimer > 0) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = -1;
  }

  async refreshTokenAuth(refreshToken) {
    try {
      console.log('== refreshTokenAuth BEGIN ==');

      const params = {
        ClientId: CLIENT_ID,
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken || this.getRefreshToken(),
        },
      };

      const command = new InitiateAuthCommand(params);

      const authenticationResult = await _cognitoIdpClient.send(command)
        .then((res) =>
          res.AuthenticationResult);

      this.reinitialize(authenticationResult);

      await this.getCredentials(true);

      console.log('== refreshTokenAuth SUCCEEDED ==');
    } catch (e) {
      console.log('== refreshTokenAuth FAILED ==');

      console.log(
        'ERR:',
        'UserSession.refreshTokenAuth:',
        'InitiateAuthCommand:',
        (e.$metadata || {}).httpStatusCode,
        e.name,
        e.message
      );
    }
  }

  fromCredentials() {
    return new Promise((resolve) => {
      const creds = this.credentials;
      resolve({
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretKey,
        sessionToken: creds.SessionToken,
        expiration: creds.Expiration,
      });
    });
  }

  withCognitoIdentityPool() {
    let endpoint = new URL(this.idToken.payload.iss);
    endpoint = [
      endpoint.hostname,
      endpoint.pathname,
    ].join('');

    const logins = {
      [endpoint]: this.idToken.token,
    };
    return {
      identityPoolId: IDENTITYPOOL_ID,
      logins,
      clientConfig: {
        region: REGION,
      },
    };
  }

  withCognitoIdentity() {
    let endpoint = new URL(this.idToken.payload.iss);
    endpoint = [
      endpoint.hostname,
      endpoint.pathname,
    ].join('');

    const logins = {
      [endpoint]: this.idToken.token,
    };

    return {
      identityId: this.identityId,
      logins,
      clientConfig: {
        region: REGION,
      },
    };
  }
}

const CreateUserSessionFromAuth = async (
  authenticationResult
) => {
  if (_singleton) {
    console.log(
      'CreateUserSessionFromAuth',
      'singleton exists, update user session'
    );

    await _singleton.update(authenticationResult);
  } else {
    console.log(
      'CreateUserSessionFromAuth',
      'singleton not exists, create a new user session'
    );

    const notused = new UserSession(
      authenticationResult
    );
  }

  /* cache username and refreshToken */
  const store = GetSettingStore();
  await Promise.all([
    [
      OPT_USERNAME,
      _singleton.username,
    ],
    [
      OPT_REFRESH_TOKEN,
      _singleton.getRefreshToken(),
    ],
  ].map((item) =>
    store.putItem(item[0], item[1])));

  return _singleton;
};

const GetUserSession = () => {
  if (_singleton === undefined) {
    const notused_ = new UserSession();
  }

  return _singleton;
};

const LoadUserSessionFromCache = async () => {
  try {
    const store = GetSettingStore();

    const [
      username,
      refreshToken,
    ] = await Promise.all([
      OPT_USERNAME,
      OPT_REFRESH_TOKEN,
    ].map((key) =>
      store.getItem(key)));

    if (username === undefined || refreshToken === undefined) {
      return undefined;
    }

    const session = GetUserSession();

    await session.refreshTokenAuth(refreshToken);

    return session;
  } catch (e) {
    console.error(
      'ERR:',
      'UserSession.LoadUserSessionFromCache:',
      e.message
    );

    return undefined;
  }
};

const RegisterUserSessionEvent = (name, target) => {
  if (!name || typeof target !== 'function') {
    return false;
  }

  _receivers[name] = target;
  return true;
};

const UnregisterUserSessionEvent = (name) => {
  delete _receivers[name];
};

export {
  UserSession,
  GetUserSession,
  LoadUserSessionFromCache,
  CreateUserSessionFromAuth,
  RegisterUserSessionEvent,
  UnregisterUserSessionEvent,
  SESSION_SIGNIN,
  SESSION_SIGNOUT,
  SESSION_TOKEN_REFRESHED,
  OPT_USERNAME,
};
