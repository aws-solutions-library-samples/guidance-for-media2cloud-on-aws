// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

const HTTPS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureHTTPs(require('https'));
  } catch (e) {
    console.log('aws-xray-sdk not loaded');
    return require('https');
  }
})();

/**
 * @class ServiceAvailability
 * @description helper function to check service availability
 */
class ServiceAvailability {
  static get Regions() {
    return [
      'us-east-1',
      'us-east-2',
      'us-west-1',
      'us-west-2',
      'ca-central-1',
      'eu-west-1',
      'eu-west-2',
      'eu-west-3',
      'eu-north-1',
      'eu-central-1',
      'me-south-1',
      'ap-east-1',
      'ap-south-1',
      'ap-northeast-1',
      'ap-northeast-2',
      'ap-northeast-3',
      'ap-southeast-1',
      'ap-southeast-2',
      'sa-east-1',
      'cn-north-1',
      'cn-northwest-1',
    ];
  }

  /**
   * @static
   * @async
   * @function probe
   * @description check to see if service is availabile for the region.
   * @param {string} service
   * @param {string} [region]
   */
  static async probe(service, region = process.env.AWS_REGION) {
    return new Promise((resolve, reject) => {
      if (!service) {
        throw new Error('service must be provided');
      }

      const params = {
        method: 'HEAD',
        hostname: `${service}.${region}.amazonaws.com`,
        port: 443,
      };

      const buffers = [];

      const request = HTTPS.request(params, (response) => {
        response.on('data', chunk =>
          buffers.push(chunk));

        response.on('end', () =>
          resolve(true));
      });

      request.on('error', e =>
        ((e.code === 'ENOTFOUND') ? resolve(false) : reject(e)));

      request.end();
    });
  }
}

module.exports = ServiceAvailability;
