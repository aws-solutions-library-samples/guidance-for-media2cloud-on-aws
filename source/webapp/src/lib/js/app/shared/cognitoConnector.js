// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import SolutionManifest from '/solution-manifest.js';
import AppUtils from './appUtils.js';

const ID_DEMOAPP = '#demo-app';
const ID_EVENTSOURCE = `cognito-${AppUtils.randomHexstring()}`;
const ON_SESSION_REFRESH = 'cognito:session:refresh';
const ON_SESSION_SIGNIN = 'cognito:session:signin';
const ON_SESSION_SIGNOUT = 'cognito:session:signout';

export default class CognitoConnector {
  constructor() {
    this.$user = undefined;
    this.$sessionTimer = undefined;
    this.$userPool = new AmazonCognitoIdentity.CognitoUserPool({
      UserPoolId: SolutionManifest.Cognito.UserPoolId,
      ClientId: SolutionManifest.Cognito.ClientId,
    });
    AWS.config.region = SolutionManifest.Region;
    this.$eventSource = $('<div/>').attr('id', ID_EVENTSOURCE);
    $(ID_DEMOAPP).append(this.$eventSource);
  }

  static getSingleton() {
    if (!window.AWSomeNamespace.CognitoConnectorSingleton) {
      window.AWSomeNamespace.CognitoConnectorSingleton = new CognitoConnector();
    }
    return window.AWSomeNamespace.CognitoConnectorSingleton;
  }

  static get Events() {
    return {
      Session: {
        SignIn: ON_SESSION_SIGNIN,
        SignOut: ON_SESSION_SIGNOUT,
        Refresh: ON_SESSION_REFRESH,
      },
    };
  }

  get eventSource() {
    return this.$eventSource;
  }

  get user() {
    return this.$user;
  }

  set user(val) {
    this.$user = val;
  }

  get userPool() {
    return this.$userPool;
  }

  set userPool(val) {
    this.$userPool = val;
  }

  get isAnonymousUser() {
    return !(this.userPool.getCurrentUser());
  }

  get sessionTimer() {
    return this.$sessionTimer;
  }

  set sessionTimer(val) {
    this.$sessionTimer = val;
  }

  getCognitoIdpEndpoint() {
    return `cognito-idp.${SolutionManifest.Region}.amazonaws.com/${SolutionManifest.Cognito.UserPoolId}`;
  }

  /**
   * @function getUserSession
   * @description wrapper to Cognito getSession to get current user session
   * @param {CognitoUser} user
   */
  async getUserSession(user) {
    return new Promise((resolve, reject) => {
      const currentUser = user || this.user;
      if (!currentUser) {
        reject(new Error('no current user'));
        return;
      }
      currentUser.getSession((e, session) =>
        ((e)
          ? reject(new Error(e))
          : resolve(session)));
    });
  }

  /**
   * @function checkStatus
   * @description check if there is current, valid coginto user
   */
  async checkStatus() {
    this.user = this.userPool.getCurrentUser();
    if (!this.user) {
      throw new Error('no current user');
    }

    const session = await this.getUserSession(this.user);
    if (!session.isValid()) {
      const username = this.user.username;
      this.user.signOut();
      this.user = undefined;
      throw Error(`session expired for ${username}`);
    }
    return this.user;
  }

  /**
   * @function onSuccess
   * @description callback from authentication
   * @param {function} resolve
   * @param {function} reject
   * @param {object} data
   */
  async onSuccess(resolve, reject, data) {
    console.log(`${this.user.username} logged in`);
    return resolve({
      status: 'completed',
    });
  }

  /**
   * @function onFailure
   * @description callback from authentication
   * @param {function} resolve
   * @param {function} reject
   * @param {Error} e
   */
  async onFailure(resolve, reject, e) {
    this.user = undefined;
    return reject(new Error(e.message));
  }

  /**
   * @function newPasswordRequired
   * @description callback from authentication
   * @param {function} resolve
   * @param {function} reject
   * @param {object} userAttributes
   * @param {object} requiredAttributes
   */
  async newPasswordRequired(resolve, reject, userAttributes, requiredAttributes) {
    resolve({
      status: 'newPasswordRequired',
      userAttributes,
      requiredAttributes,
    });
  }

  /**
   * @function confirmNewPassword
   * @description handle FORCE_CHANGE_PASSWORD message where user is required
   * to set new password
   * @param {string} Password
   */
  async confirmNewPassword(Password) {
    return new Promise((resolve, reject) => {
      this.user.completeNewPasswordChallenge(Password, {}, {
        onSuccess: this.onSuccess.bind(this, resolve, reject),
        onFailure: this.onFailure.bind(this, resolve, reject),
      });
    });
  }

  /**
   * @function authenticate
   * @description authenticate user with Cognito service
   * @param {object} params
   */
  async authenticate(params) {
    return new Promise((resolve, reject) => {
      const missing = [
        'Username',
        'Password',
      ].filter(x => !x);

      if (missing.length) {
        reject(new Error('invalid username or password'));
      }

      const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: params.Username,
        Password: params.Password,
      });

      this.user = new AmazonCognitoIdentity.CognitoUser({
        Username: params.Username,
        Pool: this.userPool,
      });

      this.user.authenticateUser(authenticationDetails, {
        onSuccess: this.onSuccess.bind(this, resolve, reject),
        onFailure: this.onFailure.bind(this, resolve, reject),
        newPasswordRequired: this.newPasswordRequired.bind(this, resolve, reject),
      });
    });
  }

  /**
   * @function getCredentials
   * @description get AWS credentials from Cognito IDP
   */
  async getCredentials() {
    const idToken = this.user.getSignInUserSession().getIdToken();
    const endpoint = this.getCognitoIdpEndpoint();

    const params = {
      IdentityPoolId: SolutionManifest.Cognito.IdentityPoolId,
      Logins: {
        [endpoint]: idToken.getJwtToken(),
      },
    };

    const identityCredentials = new AWS.CognitoIdentityCredentials(params, {
      region: SolutionManifest.Region,
    });

    return new Promise((resolve) => {
      identityCredentials.getPromise().then(() => {
        AWS.config.credentials = identityCredentials;
        AWS.config.region = SolutionManifest.Region;
        this.monitorSession(idToken.getExpiration());
        resolve(identityCredentials);
      });
    });
  }

  /**
   * @function toStringFromMsecs
   * @description helper function to format millsecs into HH:MM:SS.mmm
   * @param {number} msec
   * @return {string}
   */
  static toStringFromMsecs(msec) {
    const HH = Math.floor(msec / 3600000).toString().padStart(2, '0');
    const MM = Math.floor((msec % 3600000) / 60000).toString().padStart(2, '0');
    const SS = Math.floor((msec % 60000) / 1000).toString().padStart(2, '0');
    const mmm = Math.ceil(msec % 1000).toString().padStart(3, '0');
    return `${HH}:${MM}:${SS}.${mmm}`;
  }

  /**
   * @function signOut
   * @description onSignOut, reset credential.
   */
  signOut() {
    const username = this.user.username;
    this.user.signOut();
    AWS.config.credentials = undefined;
    this.eventSource.trigger(CognitoConnector.Events.Session.SignOut, [username]);
  }

  async signIn() {
    await this.checkStatus();
    const credentials = await this.getCredentials();
    this.eventSource.trigger(CognitoConnector.Events.Session.SignIn, [credentials]);
    return this.user;
  }

  /**
   * @function refreshSession
   * @description refresh the session periodically
   */
  async refreshSession() {
    const currentSession = await this.getUserSession();
    await new Promise((resolve, reject) => {
      this.user.refreshSession(currentSession.refreshToken, (e, refresh) =>
        ((e)
          ? reject(new Error(e))
          : resolve(refresh)));
    });
    const credential = await this.getCredentials();
    this.eventSource.trigger(CognitoConnector.Events.Session.Refresh, [credential]);
    return credential;
  }

  /**
   * @function monitorSession
   * @description refresh session before the session is expired.
   * @param {number} expiration - in seconds
   */
  monitorSession(expiration) {
    const dateExp = new Date(expiration * 1000);
    const refresh = dateExp - new Date() - (10 * 1000);

    console.log(`schedule to refresh session in ${CognitoConnector.toStringFromMsecs(refresh)} (${dateExp.toISOString()})`);

    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(async () =>
      this.refreshSession().catch((e) =>
        console.error(encodeURIComponent(e.message))), refresh);
  }

  /**
   * @function forgotPasswordFlow
   * @description run forgot password flow
   * @param {object} params
   */
  async forgotPasswordFlow(params = {}) {
    return new Promise((resolve, reject) => {
      if (!params.Username) {
        reject(new Error('invalid username'));
      }

      this.user = new AmazonCognitoIdentity.CognitoUser({
        Username: params.Username,
        Pool: this.userPool,
      });

      /* start the forgot password flow */
      this.user.forgotPassword({
        onSuccess: this.onSuccess.bind(this, resolve, reject),
        onFailure: this.onFailure.bind(this, resolve, reject),
        inputVerificationCode: this.inputVerificationCode.bind(this, resolve, reject),
      });
    });
  }

  /**
   * @function inputVerificationCode
   * @description callback from authentication
   * @param {function} resolve
   * @param {function} reject
   * @param {object} data
   */
  async inputVerificationCode(resolve, reject, data) {
    resolve({
      status: 'inputVerificationCode',
      data,
    });
  }

  /**
   * @function confirmPassword
   * @description complete forgot password flow to confirm both verificationCode and Password
   * @param {string} VerificationCode
   * @param {string} Password
   */
  async confirmPassword(VerificationCode, Password) {
    return new Promise((resolve, reject) => {
      this.user.confirmPassword(VerificationCode, Password, {
        onSuccess: this.onSuccess.bind(this, resolve, reject),
        onFailure: this.onFailure.bind(this, resolve, reject),
      });
    });
  }
}
