/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const {
  CommonUtils,
} = require('core-lib');
const PrivateWorkforce = require('./workteam/privateWorkforce');
const BaseOp = require('./baseOp');

class WorkteamOp extends BaseOp {
  async onGET() {
    const teamName = (this.request.pathParameters || {}).uuid;
    /* if teamName not specified, use default setting. */
    if (teamName && !CommonUtils.validateSageMakerWorkteamName(teamName)) {
      throw new Error('invalid team name');
    }

    const team = new PrivateWorkforce(teamName);
    return super.onGET(await team.listMembers());
  }

  async onPOST() {
    const data = this.request.body;

    const teamName = (this.request.pathParameters || {}).uuid || data.teamName;
    if (!teamName || !data.member) {
      throw new Error('teamName and member must not be null');
    }

    if (!CommonUtils.validateSageMakerWorkteamName(teamName)) {
      throw new Error('invalid team name');
    }

    if (!CommonUtils.validateEmailAddress(data.member)) {
      throw new Error('invalid email address');
    }

    const team = new PrivateWorkforce(teamName);
    return super.onPOST(await team.addMember(data.member));
  }

  async onDELETE() {
    const {
      member,
      teamName = (this.request.pathParameters || {}).uuid,
    } = this.request.queryString || {};

    if (!teamName || !member) {
      throw new Error('missing teamName and member querystring');
    }

    if (!CommonUtils.validateSageMakerWorkteamName(teamName)) {
      throw new Error('invalid team name');
    }

    if (!CommonUtils.validateEmailAddress(member)) {
      throw new Error('invalid email address');
    }

    const team = new PrivateWorkforce(teamName);
    return super.onDELETE(await team.deleteMember(member));
  }
}

module.exports = WorkteamOp;
