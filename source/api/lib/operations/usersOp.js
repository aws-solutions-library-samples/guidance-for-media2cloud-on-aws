// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  /* exceptions */
  InternalErrorException,
  UsernameExistsException,
  UserNotFoundException,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  Environment,
  CommonUtils,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const OP_USERS = 'users';
const STATUS_ADDED = 'added';
const STATUS_REMOVED = 'removed';
const STATUS_ERROR = 'error';
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;
const USERPOOL_ID = Environment.Cognito.UserPoolId;

class UsersOp extends BaseOp {
  async onPOST() {
    const op = this.request.pathParameters.operation;
    if (op === OP_USERS) {
      return super.onPOST(await this.onPostUsers());
    }
    throw new M2CException('invalid operation');
  }

  async onDELETE() {
    const op = this.request.pathParameters.operation;
    if (op === OP_USERS) {
      return super.onDELETE(await this.onDeleteUsers());
    }
    throw new M2CException('invalid operation');
  }

  async onGET() {
    const op = this.request.pathParameters.operation;
    if (op === OP_USERS) {
      return super.onGET(await this.onGetUsers());
    }
    throw new M2CException('invalid operation');
  }

  async onGetUsers() {
    let command;
    let response;
    let users = [];

    do {
      const cognitoIdpClient = xraysdkHelper(new CognitoIdentityProviderClient({
        customUserAgent: CUSTOM_USER_AGENT,
        retryStrategy: retryStrategyHelper(),
      }));

      command = new ListUsersCommand({
        UserPoolId: USERPOOL_ID,
        Limit: 10,
        PaginationToken: (response || {}).PaginationToken,
      });

      response = await cognitoIdpClient.send(command)
        .catch((e) => {
          console.error(
            'ERR:',
            'UsersOp.onGetUers:',
            'ListUsersCommand:',
            e.$metadata.httpStatusCode,
            e.name,
            e.message
          );
          return undefined;
        });

      if (response && response.Users.length) {
        let responses = await Promise.all(response.Users
          .map((user) => {
            command = new AdminListGroupsForUserCommand({
              UserPoolId: USERPOOL_ID,
              Username: user.Username,
              Limit: 10,
            });

            return cognitoIdpClient.send(command)
              .then((res) => {
                const group = res.Groups
                  .sort((a, b) =>
                    a.Precedence - b.Precedence)[0];
                if (group === undefined) {
                  return undefined;
                }

                const email = (user.Attributes
                  .find((x) =>
                    x.Name === 'email') || {})
                  .Value;
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
                console.error(
                  'ERR:',
                  'UsersOp.onGetUers:',
                  'AdminListGroupsForUserCommand:',
                  e.$metadata.httpStatusCode,
                  e.name,
                  e.message
                );
                return undefined;
              });
          }));

        responses = responses
          .flat()
          .filter((x) =>
            x);
        users = users.concat(responses);
      }
    } while ((response || {}).PaginationToken);

    return users;
  }

  async onPostUsers() {
    const users = this.request.body || [];

    return Promise.all(users
      .map((user) =>
        this.createUserInGroup({
          userPoolId: USERPOOL_ID,
          ...user,
        })));
  }

  async createUserInGroup(user) {
    try {
      if (!CommonUtils.validateEmailAddress(user.email)) {
        throw new M2CException('invalid email address');
      }

      let username = user.username;
      if (username === undefined || username.length === 0) {
        username = user.email.split('@').filter(x =>
          x).shift();
      }
      if (!CommonUtils.validateUsername(username)) {
        throw new M2CException('invalid username');
      }

      const cognitoIdpClient = xraysdkHelper(new CognitoIdentityProviderClient({
        customUserAgent: CUSTOM_USER_AGENT,
        retryStrategy: retryStrategyHelper(),
      }));

      let command;
      command = new AdminCreateUserCommand({
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
      });

      let response = await cognitoIdpClient.send(command)
        .then((res) =>
          res.User)
        .catch((e) => {
          if (e instanceof UsernameExistsException) {
            return undefined;
          }
          throw e;
        });

      /* user already exits, gets the user information */
      if (response === undefined) {
        command = new AdminGetUserCommand({
          UserPoolId: user.userPoolId,
          Username: username,
        });

        response = await cognitoIdpClient.send(command)
          .catch((e) => {
            console.error(
              'ERR:',
              'UsersOp.createUserInGroup:',
              'AdminGetUserCommand:',
              e.$metadata.httpStatusCode,
              e.name,
              e.message
            );
            throw e;
          });
      }

      if (!response) {
        throw new InternalErrorException(`fail to add user, ${user.email}`);
      }

      /* add user to group */
      command = new AdminAddUserToGroupCommand({
        GroupName: user.group,
        UserPoolId: user.userPoolId,
        Username: response.Username,
      });

      return cognitoIdpClient.send(command)
        .then(() => ({
          email: user.email,
          group: user.group,
          status: response.UserStatus,
          username: response.Username,
          enabled: response.Enabled,
          lastModified: new Date(response.UserLastModifiedDate).getTime(),
        }));
    } catch (e) {
      return {
        status: STATUS_ERROR,
        error: `${e.name} - ${e.message}`,
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
      const cognitoIdpClient = xraysdkHelper(new CognitoIdentityProviderClient({
        customUserAgent: CUSTOM_USER_AGENT,
        retryStrategy: retryStrategyHelper(),
      }));

      const command = new AdminDeleteUserCommand({
        UserPoolId: USERPOOL_ID,
        Username: user,
      });

      return cognitoIdpClient.send(command)
        .then(() => ({
          user,
          status: STATUS_REMOVED,
        }))
        .catch((e) => {
          if (e instanceof UserNotFoundException) {
            return undefined;
          }
          throw e;
        });
    } catch (e) {
      return {
        user,
        status: STATUS_ERROR,
        error: `${e.name} - ${e.message}`,
      };
    }
  }
}

module.exports = UsersOp;
