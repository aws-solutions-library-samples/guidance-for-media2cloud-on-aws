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
 * @description Json definition object, loadFromJsonFile
 */
const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

module.exports = {
  System: 'not specified',
  Bucket: 'glacier-bucket',
  Key: 'mock/json-definition.json',
  UUID: X.zeroUUID(),
  MD5: X.zeroMD5(),
  LastModified: new Date().getTime(),
  ContentLength: 800,
  ContentType: 'application/json',
  IngestDate: new Date().toISOString(),
  Category: 'mock-category',
  Comments: 'no comments',
  Description: 'not specified',
  Name: 'video',
  Files: [
    {
      name: 'mock/video.mp4',
      md5: X.zeroMD5(),
      uuid: X.zeroUUID(),
    },
  ],
  RawJson: {},
};
