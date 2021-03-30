/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/* eslint-disable import/no-unresolved */

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
