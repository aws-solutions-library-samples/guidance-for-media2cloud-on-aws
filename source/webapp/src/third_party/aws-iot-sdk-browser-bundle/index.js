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
const AWS = require('aws-sdk');

const AWSIoTData = require('aws-iot-device-sdk');

/**
 * This file is to wrap AWSIoTData and AWS into browserify package
 */
module.exports.AWS = AWS;
global.AWS = AWS;

module.exports.AWSIoTData = AWSIoTData;
global.AWSIoTData = AWSIoTData;

