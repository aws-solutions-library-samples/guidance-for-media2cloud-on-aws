// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

/* eslint-disable no-undef */
const AWS = require('aws-sdk');
const AWSIoTData = require('aws-iot-device-sdk');

module.exports.AWS = AWS;
global.AWS = AWS;

module.exports.AWSIoTData = AWSIoTData;
global.AWSIoTData = AWSIoTData;
