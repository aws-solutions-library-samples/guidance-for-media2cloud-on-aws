// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

const RekogHelper = require('../shared/rekogHelper');
const BaseState = require('../shared/baseState');

class StateCheckProjectVersionStatus extends BaseState {
  get [Symbol.toStringTag]() {
    return 'StateCheckProjectVersionStatus';
  }

  async process() {
    const output = await this.checkProjectVersionStatus();
    this.setOutput(BaseState.States.CheckProjectVersionStatus, output);
    return super.process();
  }

  async checkProjectVersionStatus() {
    return RekogHelper.describeProjectVersion(this.projectArn, this.projectVersionArn);
  }
}

module.exports = StateCheckProjectVersionStatus;
