// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const DB = require('./db');
const Environment = require('./environment');
const {
  ConfigurationError,
} = require('./error');

/**
 * @class ServiceToken
 * @description helper function to register step functions token to DDB
 */
class ServiceToken {
  static get Token() {
    return {
      Name: 'token',
    };
  }

  /**
   * @function timeToLiveInSecond
   * @description compute TTL
   * @param {number} days
   */
  static timeToLiveInSecond(days = 2) {
    return Math.floor((new Date().getTime() / 1000)) + (days * 86400);
  }

  static getDB() {
    if (!Environment.DynamoDB.ServiceToken.Table
      || !Environment.DynamoDB.ServiceToken.PartitionKey
      || !Environment.DynamoDB.ServiceToken.SortKey) {
      throw new ConfigurationError('ddb table not exists');
    }

    return new DB({
      Table: Environment.DynamoDB.ServiceToken.Table,
      PartitionKey: Environment.DynamoDB.ServiceToken.PartitionKey,
      SortKey: Environment.DynamoDB.ServiceToken.SortKey,
    });
  }

  /**
   * @static
   * @async
   * @function register
   * @description set Step Functions token to DynamoDB table
   * @param {string} id - unique id
   * @param {string} token - step functions token
   * @param {string} service - service name
   * @param {string} api - api name
   * @param {object} data - JSON object
   */
  static async register(id, token, service, api, data) {
    return (ServiceToken.getDB()).update(id, ServiceToken.Token.Name, {
      token,
      service,
      api,
      data,
      ttl: ServiceToken.timeToLiveInSecond(1),
    }, false);
  }

  /**
   * @static
   * @async
   * @function unregister
   * @description purge Step Functions token from DynamoDB table
   * @param {string} id - unique id
   */
  static async unregister(id) {
    return (ServiceToken.getDB()).purge(id, ServiceToken.Token.Name);
  }

  /**
   * @static
   * @async
   * @function getData
   * @description get data from DynamoDB table
   * @param {string} id - unique id
   */
  static async getData(id) {
    return (ServiceToken.getDB()).fetch(id, ServiceToken.Token.Name);
  }
}

module.exports = ServiceToken;
