// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

let https = require('node:https');
const {
  M2CException,
} = require('./error');

if (process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined) {
  try {
    const {
      captureHTTPs,
    } = require('aws-xray-sdk-core');
    https = captureHTTPs(require('node:https'));
  } catch (e) {
    console.log('aws-xray-sdk-core not loaded');
  }
}

const REGION = process.env.AWS_REGION;

/* regions that support all AI/ML services and fulll features */
const WHITELISTED_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-south-1',
  'ap-northeast-1', /* Textract not in Tokyo region */
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
];

const SERVICE_LIST = [
  'rekognition',
  'comprehend',
  'transcribe',
  'textract',
];

/**
 * @class ServiceAvailability
 * @description helper function to check service availability
 */
class ServiceAvailability {
  /**
   * @static
   * @async
   * @function probe
   * @description check to see if service is availabile for the region.
   * @param {string} service
   * @param {string} [region]
   */
  static async probe(
    service,
    region = REGION
  ) {
    return new Promise((resolve, reject) => {
      if (!service) {
        throw new M2CException('service must be provided');
      }

      if (!SERVICE_LIST.includes(service)) {
        resolve(false);
        return;
      }

      if (WHITELISTED_REGIONS.includes(region)) {
        resolve(true);
        return;
      }

      const params = {
        method: 'HEAD',
        hostname: `${service}.${region}.amazonaws.com`,
        port: 443,
        timeout: 1000,
      };

      const request = https.request(params, (response) => {
        response.on('end', () => {
          resolve(true);
        });
      });

      request.on('timeout', () => {
        request.destroy();
      });

      request.on('error', (e) => {
        if (e.code === 'ECONNRESET' || e.code === 'ENOTFOUND') {
          resolve(false);
          return;
        }
        reject(e);
      });

      request.end();
    });
  }
}

module.exports = ServiceAvailability;
