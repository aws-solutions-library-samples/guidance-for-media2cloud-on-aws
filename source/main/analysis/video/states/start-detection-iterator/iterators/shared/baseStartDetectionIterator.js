// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const CRYPTO = require('crypto');
const {
  StateData,
  AnalysisError,
  ServiceToken,
} = require('core-lib');

const CATEGORY = 'rekognition';

class BaseStartDetectionIterator {
  constructor(stateData, subCategory) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    /* detection type such as label, celeb, and etc */
    if (!subCategory) {
      throw new AnalysisError('subCategory not specified');
    }
    this.$stateData = stateData;
    this.$subCategory = subCategory;
    /* derived class to implement */
    this.$paramOptions = undefined;
    this.$func = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'BaseStartDetectionIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  get subCategory() {
    return this.$subCategory;
  }

  get paramOptions() {
    return this.$paramOptions;
  }

  set paramOptions(val) {
    this.$paramOptions = val;
  }

  get func() {
    return this.$func;
  }

  async process() {
    if (!this.func) {
      throw new AnalysisError('this.$func not impl');
    }
    let id = CRYPTO.randomBytes(4).toString('hex');
    id = `${this.stateData.uuid}-${this.subCategory}-${id}`;
    const params = this.makeParams(id);
    await this.func(id, params);
    const data = this.stateData.data[this.subCategory];
    data.backlogId = id;
    data.startTime = Date.now();
    const responseData = this.stateData.toJSON();
    await ServiceToken.register(
      id,
      this.stateData.event.token,
      CATEGORY,
      this.subCategory,
      responseData
    );
    return responseData;
  }

  makeParams(id) {
    const data = this.stateData.data[this.subCategory];
    return {
      JobTag: id,
      Video: {
        S3Object: {
          Bucket: data.bucket,
          Name: data.key,
        },
      },
      ...this.paramOptions,
    };
  }
}

module.exports = BaseStartDetectionIterator;
