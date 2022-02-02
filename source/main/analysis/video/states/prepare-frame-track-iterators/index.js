// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisError,
} = require('core-lib');

const ITERATORS = 'iterators';

class StatePrepareFrameTrackIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StatePrepareFrameTrackIterators';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const stateData = {
      uuid: this.stateData.uuid,
      status: StateData.Statuses.NotStarted,
      progress: 0,
    };
    const detections = this.stateData.data.iterators.reduce((a0, c0) => ({
      ...a0,
      ...c0.data,
    }), {});
    const iterators = Object.keys(detections).map(x => {
      /* reset cursor */
      detections[x].cursor = 0;
      return {
        ...stateData,
        data: {
          [x]: detections[x],
        },
      };
    });
    /* prepare iterators */
    this.stateData.input = undefined;
    this.stateData.data = undefined;
    this.stateData.data = {
      [ITERATORS]: iterators,
    };
    return this.stateData.toJSON();
  }
}

module.exports = StatePrepareFrameTrackIterators;
