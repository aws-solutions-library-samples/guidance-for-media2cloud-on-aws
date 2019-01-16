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
 * @description S3.headObject mock response
 */
const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

module.exports = {
  AcceptRanges: 'bytes',
  LastModified: new Date().toISOString(),
  ContentLength: 1953014,
  ETag: `"${X.zeroMD5()}"`,
  ContentType: 'video/mp4',
  ServerSideEncryption: 'AES256',
  Metadata: {
    md5: X.zeroMD5(),
    uuid: X.zeroUUID(),
  },
  StorageClass: 'GLACIER',
};
