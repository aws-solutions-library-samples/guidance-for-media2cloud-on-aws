/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* Definitions of store response data */

/**
  * @mixin mxBaseResponse
  * @description base class for custom resource
  *
  */
const mxBaseResponse = Base => class extends Base {
  constructor(event, context) {
    super(event, context);

    this.$event = event;
    this.$context = context;

    const {
      RequestType,
    } = this.$event || {};

    this.$requestType = RequestType || '';

    /* responseData */
    this.$responseData = {};
  }

  get responseData() {
    return this.$responseData;
  }

  get requestType() {
    return this.$requestType;
  }

  /**
    * @function isRequestType
    * @param {string} type
    */
  isRequestType(type) {
    return this.requestType.toLowerCase() === type.toLowerCase();
  }

  /**
    * @function storeResponseData
    * @param {string} key
    * @param {string|object} value. If is object, expects the object (hash) to have the same 'key'
    */
  storeResponseData(key, val) {
    if (val === undefined || val === null) {
      delete this.$responseData[key];
    } else if (typeof val !== 'object') {
      this.$responseData[key] = val;
    } else {
      this.$responseData[key] = val[key];
    }

    return this;
  }
};

module.exports.mxBaseResponse = mxBaseResponse;

