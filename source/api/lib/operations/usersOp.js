// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const {
  Environment,
  CommonUtils,
} = require('core-lib');
const BaseOp = require('./baseOp');

const OP_USERS = 'users';
const STATUS_ADDED = 'added';
const STATUS_REMOVED = 'removed';
const STATUS_ERROR = 'error';

class UsersOp extends BaseOp {
  static createInstance() {
    return new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
  }

  async onPOST() {
    const op = this.request.pathParameters.operation;
    if (op === OP_USERS) {
      return super.onPOST(await this.onPostUsers());
    }
    throw new Error('UsersOp.onPOST not impl');
  }

  async onDELETE() {
    const op = this.request.pathParameters.operation;
    if (op === OP_USERS) {
      return super.onDELETE(await this.onDeleteUsers());
    }
    throw new Error('UsersOp.onDELETE not impl');
  }

  async onGET() {
    const op = this.request.pathParameters.operation;
    if (op === OP_USERS) {
      return super.onGET(await this.onGetUsers());
    }
    throw new Error('invalid operation');
  }

  async onGetUsers() {
    const idp = UsersOp.createInstance();

    let response;
    const users = [];
    do {
      response = await idp.listUsers({
        UserPoolId: Environment.Cognito.UserPoolId,
        Limit: 10,
        PaginationToken: (response || {}).PaginationToken,
      }).promise()
        .catch((e) => {
          console.log(`[ERR]: onGetUsers: listUsers: ${e.code} ${e.message}`);
          return undefined;
        });
      if (response && response.Users.length) {
        let responses = await Promise.all(response.Users.map((user) =>
          idp.adminListGroupsForUser({
            UserPoolId: Environment.Cognito.UserPoolId,
            Username: user.Username,
            Limit: 10,
          }).promise()
            .then((res) => {
              const group = res.Groups.sort((a, b) =>
                a.Precedence - b.Precedence)[0];
              if (group === undefined) {
                return undefined;
              }
              const email = (user.Attributes.find((x) =>
                x.Name === 'email') || {}).Value;
              if (email === undefined) {
                return undefined;
              }
              return {
                email,
                group: group.GroupName,
                lastModified: new Date(user.UserLastModifiedDate).getTime(),
                username: user.Username,
                status: user.UserStatus,
                enabled: user.Enabled,
              };
            })
            .catch((e) => {
              console.log(`[ERR]: onGetUsers: adminListGroupsForUser: ${user.Username}: ${e.code} ${e.message}`);
              return undefined;
            })));
        responses = responses.flat()
          .filter((x) => x);
        users.splice(users.length, 0, ...responses);
      }
    } while ((response || {}).PaginationToken);
    return users;
  }

  async onPostUsers() {
    const users = this.request.body || [];
    const idp = UsersOp.createInstance();

    return Promise.all(users.map((user) =>
      this.createUserInGroup(idp, {
        userPoolId: Environment.Cognito.UserPoolId,
        ...user,
      })));
  }

  async createUserInGroup(idp, user) {
    try {
      if (!CommonUtils.validateEmailAddress(user.email)) {
        const err = new Error('invalid email address');
        err.code = 'InvalidParameterError';
        throw err;
      }
      let username = user.username;
      if (username === undefined || username.length === 0) {
        username = user.email.split('@').filter(x =>
          x).shift();
      }
      if (!CommonUtils.validateUsername(username)) {
        const err = new Error('invalid username');
        err.code = 'InvalidParameterError';
        throw err;
      }

      let response = await idp.adminCreateUser({
        UserPoolId: user.userPoolId,
        Username: username,
        DesiredDeliveryMediums: [
          'EMAIL',
        ],
        UserAttributes: [
          {
            Name: 'email',
            Value: user.email,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
      }).promise()
        .then((res) =>
          res.User)
        .catch((e) => {
          if (e.code === 'UsernameExistsException') {
            return undefined;
          }
          throw e;
        });

      /* user already exits, gets the user information */
      if (response === undefined) {
        response = await idp.adminGetUser({
          UserPoolId: user.userPoolId,
          Username: username,
        }).promise()
          .catch((e) => {
            console.log(`[ERR]: adminGetUser: ${username}: ${e.code} - ${e.message}`);
            throw e;
          });
      }

      if (!response) {
        const err = new Error(`fail to add user, ${user.email}`);
        err.code = 'UnknownError';
        throw err;
      }

      /* add user to group */
      await idp.adminAddUserToGroup({
        GroupName: user.group,
        UserPoolId: user.userPoolId,
        Username: response.Username,
      }).promise();

      return {
        email: user.email,
        group: user.group,
        status: response.UserStatus,
        username: response.Username,
        enabled: response.Enabled,
        lastModified: new Date(response.UserLastModifiedDate).getTime(),
      };
    } catch (e) {
      return {
        status: STATUS_ERROR,
        error: `${e.code} - ${e.message}`,
        email: user.email,
        group: user.group,
      };
    }
  }

  async onDeleteUsers() {
    const {
      user,
    } = this.request.queryString || {};

    try {
      const idp = UsersOp.createInstance();
      await idp.adminDeleteUser({
        UserPoolId: Environment.Cognito.UserPoolId,
        Username: user,
      }).promise()
        .catch((e) => {
          if (e.code === 'UserNotFoundException') {
            return undefined;
          }
          throw e;
        });
      return {
        user,
        status: STATUS_REMOVED,
      };
    } catch (e) {
      return {
        user,
        status: STATUS_ERROR,
        error: `${e.code} - ${e.message}`,
      };
    }
  }
}

module.exports = UsersOp;
