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

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/**
 * @class AppUtils
 * @description common utility class for static functions
 */
class AppUtils {
  /**
   * @function signRequest
   * @description sign V4 request
   * @param {string} method
   * @param {string} endpoint
   * @param {string} path
   * @param {object} query
   * @param {string|object} body
   */
  static signRequest(method, endpoint, path, query, body) {
    const {
      AWSomeNamespace: {
        sigV4Client,
      },
    } = window;

    const signer = sigV4Client.newClient({
      accessKey: AWS.config.credentials.accessKeyId,
      secretKey: AWS.config.credentials.secretAccessKey,
      sessionToken: AWS.config.credentials.sessionToken,
      region: AWS.config.region,
      serviceName: 'execute-api',
      endpoint,
    });

    const response = signer.signRequest({
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
      },
      queryParams: query,
      body: (typeof body === 'string') ? body : JSON.stringify(body),
    });

    return response;
  }

  /**
   * @function authHttpRequest
   * @description http request with signed payload/headers
   * @param {string} method
   * @param {string} endpoint
   * @param {string} path
   * @param {object} query
   * @param {string|object} body
   */
  static async authHttpRequest(method, endpoint, query = {}, body = '') {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      const {
        url, headers,
      } = AppUtils.signRequest(method, endpoint, '', query, body);

      request.open(method, url, true);

      Object.keys(headers).forEach((x) => {
        request.setRequestHeader(x, headers[x]);
      });

      request.withCredentials = false;

      request.onerror = e =>
        reject(e);

      request.onabort = e =>
        reject(e);

      request.onreadystatechange = () => {
        if (request.readyState === XMLHttpRequest.DONE && request.status === 200) {
          resolve(JSON.parse(request.responseText));
        }
      };

      request.send((typeof body === 'string') ? body : JSON.stringify(body));
    });
  }
}
