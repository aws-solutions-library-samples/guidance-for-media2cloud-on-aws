/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */

const AWS = require('aws-sdk');

/**
 * @class PrivateWorkforce
 * @description manage Ground Truth private workteam members
 */
class PrivateWorkforce {
  constructor(teamName) {
    this.$teamName = teamName || process.env.ENV_WORKTEAM_NAME;

    this.$userGroup = undefined;
    this.$userPool = undefined;
    this.$topicArn = undefined;

    this.$cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18',
    });

    this.$sagemaker = new AWS.SageMaker({
      apiVersion: '2017-07-24',
    });

    this.$sns = new AWS.SNS({
      apiVersion: '2010-03-31',
    });
  }

  get cognito() {
    return this.$cognito;
  }

  get sagemaker() {
    return this.$sagemaker;
  }

  get sns() {
    return this.$sns;
  }

  get teamName() {
    return this.$teamName;
  }

  set teamName(val) {
    this.$teamName = val;
  }

  get userGroup() {
    return this.$userGroup;
  }

  set userGroup(val) {
    this.$userGroup = val;
  }

  get userPool() {
    return this.$userPool;
  }

  set userPool(val) {
    this.$userPool = val;
  }

  get topicArn() {
    return this.$topicArn;
  }

  set topicArn(val) {
    this.$topicArn = val;
  }

  async describeTeam() {
    if (!this.teamName) {
      throw new Error('teamName is null');
    }

    const {
      Workteam,
    } = await this.sagemaker.describeWorkteam({
      WorkteamName: this.teamName,
    }).promise();

    if (!Workteam) {
      throw new Error('workteam not found, likely caused by misconfiguration?');
    }

    const {
      UserGroup,
      UserPool,
    } = (((Workteam.MemberDefinitions || []).shift()) || {}).CognitoMemberDefinition || {};

    const {
      NotificationTopicArn,
    } = Workteam.NotificationConfiguration || {};

    if (!UserGroup || !UserPool) {
      throw new Error('user group not found, likely caused by misconfiguration?');
    }

    this.userGroup = UserGroup;
    this.userPool = UserPool;
    this.topicArn = NotificationTopicArn;
  }

  async getGroupUsers() {
    let response;
    const users = [];
    do {
      response = await this.cognito.listUsersInGroup({
        GroupName: this.userGroup,
        UserPoolId: this.userPool,
        NextToken: (response || {}).NextToken,
      }).promise();

      users.splice(users.length, 0, ...response.Users);
    } while ((response || {}).NextToken);

    /* filter enabled users and return his/her email address */
    const members = users.filter(x => x.Enabled).map(x =>
      (x.Attributes.find(x0 => x0.Name === 'email') || {}).Value).filter(x => x);

    return members;
  }

  async listMembers() {
    await this.describeTeam();

    const members = await this.getGroupUsers();

    return {
      teamName: this.teamName,
      userPool: this.userPool,
      userGroup: this.userGroup,
      topicArn: this.topicArn,
      members,
    };
  }

  async cognitoCreateUserInGroup(member) {
    const username = member.split('@').filter(x => x).shift();

    /* create user */
    try {
      await this.cognito.adminCreateUser({
        UserPoolId: this.userPool,
        Username: username,
        DesiredDeliveryMediums: [
          'EMAIL',
        ],
        UserAttributes: [
          {
            Name: 'email',
            Value: member,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
      }).promise();
    } catch (e) {
      if (e.code !== 'UsernameExistsException') {
        throw e;
      }
    }

    /* add user to group */
    await this.cognito.adminAddUserToGroup({
      GroupName: this.userGroup,
      UserPoolId: this.userPool,
      Username: username,
    }).promise();
  }

  async snsSubscribe(member) {
    if (!this.topicArn) {
      return;
    }

    /* add to SNS topic */
    await this.sns.subscribe({
      Protocol: 'email',
      TopicArn: this.topicArn,
      Endpoint: member,
    }).promise();
  }

  async addMember(member) {
    if (!member) {
      throw new Error('missing params, member');
    }

    await this.describeTeam();

    await Promise.all([
      this.cognitoCreateUserInGroup(member),
      this.snsSubscribe(member),
    ]);

    return {
      action: 'added',
      teamName: this.teamName,
      member,
    };
  }

  async cognitoDeleteUser(member) {
    const username = member.split('@').filter(x => x).shift();

    /* remove user from group */
    await this.cognito.adminRemoveUserFromGroup({
      GroupName: this.userGroup,
      UserPoolId: this.userPool,
      Username: username,
    }).promise();

    await this.cognito.adminDeleteUser({
      UserPoolId: this.userPool,
      Username: username,
    }).promise();
  }

  async snsUnsubscribe(member) {
    if (!this.topicArn) {
      return;
    }

    let response;
    const subscriptions = [];

    do {
      response = await this.sns.listSubscriptionsByTopic({
        TopicArn: this.topicArn,
        NextToken: (response || {}).NextToken,
      }).promise();

      subscriptions.splice(subscriptions.length, 0, ...response.Subscriptions);
    } while ((response || {}).NextToken);

    await Promise.all(subscriptions.map((x) => {
      if (x.Endpoint === member && x.SubscriptionArn.indexOf('arn:aws:sns') === 0) {
        return this.sns.unsubscribe({
          SubscriptionArn: x.SubscriptionArn,
        }).promise();
      }
      return undefined;
    }));
  }

  async deleteMember(member) {
    if (!member) {
      throw new Error('missing params, member');
    }

    await this.describeTeam();

    await Promise.all([
      this.cognitoDeleteUser(member),
      this.snsUnsubscribe(member),
    ]);

    return {
      action: 'deleted',
      teamName: this.teamName,
      member,
    };
  }
}

module.exports = {
  PrivateWorkforce,
};
