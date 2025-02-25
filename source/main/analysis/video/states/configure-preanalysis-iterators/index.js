// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
  Environment: {
    StateMachines: { DynamicFrameSegmentation, FaceApiModel },
  },
  AnalysisTypes: {
    Rekognition: { Celeb, FaceMatch },
  },
} = require('core-lib');

const { Statuses: { NotStarted } } = StateData;

const Region = process.env.AWS_REGION;

class StateConfigurePreAnalysisIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  static opSupported(op) {
    return op === 'StateConfigurePreAnalysisIterators';
  }

  get [Symbol.toStringTag]() {
    return 'StateConfigurePreAnalysisIterators';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    // data.iterators
    // preAnalysisStateMachineArn
    const {
      accountId,
      uuid,
      input,
      data,
    } = this.stateData;

    const arn = [
      'arn:aws:states',
      Region,
      accountId,
      'stateMachine',
    ].join(':');

    // to avoid the circular reference
    const dataCloned = JSON.parse(JSON.stringify(data));
    const inputClonded = JSON.parse(JSON.stringify(input));

    const iterators = [];

    // frame segmentation state machine
    iterators.push({
      preAnalysisStateMachineArn: `${arn}:${DynamicFrameSegmentation}`,
      uuid,
      input: inputClonded,
      data: dataCloned,
      status: NotStarted,
      progress: 0,
    });

    const { aiOptions } = input;

    // faceapi model state machine
    const {
      framebased,
      [FaceMatch]: facematch,
      [Celeb]: celeb,
    } = aiOptions;

    if (framebased && (facematch || celeb)) {
      iterators.push({
        preAnalysisStateMachineArn: `${arn}:${FaceApiModel}`,
        uuid,
        input: inputClonded,
        data: dataCloned,
        status: NotStarted,
        progress: 0,
      });
    }

    data.iterators = iterators;

    return this.stateData.toJSON();
  }
}

module.exports = StateConfigurePreAnalysisIterators;
