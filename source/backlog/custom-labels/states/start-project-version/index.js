// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const RekogHelper = require('../shared/rekogHelper');
const BaseState = require('../shared/baseState');

const DEFAULT_INFERENCEUNITS = 5;

class StateStartProjectVersion extends BaseState {
  get [Symbol.toStringTag]() {
    return 'StateStartProjectVersion';
  }

  async process() {
    const output = await this.startProjectVersion();
    this.setOutput(BaseState.States.StartProjectVersion, output);
    return super.process();
  }

  async startProjectVersion() {
    return RekogHelper.startProjectVersion({
      MinInferenceUnits: this.inferenceUnits || DEFAULT_INFERENCEUNITS,
      ProjectVersionArn: this.projectVersionArn,
    }).then(data => ({
      status: data.Status,
    }));
  }
}

module.exports = StateStartProjectVersion;
