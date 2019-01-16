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

/**
 * @description common.js to export the common classes
 */

const {
  DBConfig,
} = require('./shared/dbConfig');

const {
  VideoAsset,
  ProxyAttributes,
  GlacierAttributes,
  BaseAttributes,
} = require('./shared/videoAsset');

const {
  StateIOData,
} = require('./shared/stateIOData');

const {
  IotStatus,
} = require('./shared/iotStatus');

module.exports = {
  DBConfig,
  BaseAttributes,
  ProxyAttributes,
  GlacierAttributes,
  VideoAsset,
  StateIOData,
  IotStatus,
};
