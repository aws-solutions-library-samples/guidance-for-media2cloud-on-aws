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
/* eslint-disable import/no-unresolved */
const {
  DB,
} = require('./db');

/**
 * @class DBConfig
 * @description wrapper of configuration retrieved from DB
 * shared by both frontend / backend javascript
 */
class DBConfig {
  constructor(params) {
    const {
      ApiGatewayEndpoint,
      GlacierBucket,
      ProxyBucket,
      MediaConvertEndpoint,
      IotHost,
      MediaConvertServiceRole,
      Analytics,
      SNSTopic,
      Region,
      IotStatusTopic,
      ConfigDB,
      AssetDB,
      MediainfoDB,
      IngestStateMachine,
      MetadataStateMachine,
    } = params;

    this.$rawData = Object.assign({}, params);
    this.$apiGatewayEndpoint = ApiGatewayEndpoint;
    this.$glacierBucket = GlacierBucket;
    this.$proxyBucket = ProxyBucket;
    this.$iotHost = IotHost;
    this.$mediaConvertServiceRole = MediaConvertServiceRole;
    this.$mediaConvertEndpoint = MediaConvertEndpoint;
    this.$analytics = Analytics || {};
    this.$snsTopic = SNSTopic;
    this.$region = Region;
    this.$iotStatusTopic = IotStatusTopic;
    this.$configDB = ConfigDB || {};
    this.$assetDB = AssetDB || {};
    this.$mediainfoDB = MediainfoDB || {};
    this.$ingestStateMachine = IngestStateMachine;
    this.$metadataStateMachine = MetadataStateMachine;
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'DBConfig';
  }
  /* eslint-enable class-methods-use-this */

  /* Constant parameters */
  get region() {
    return this.$region;
  }

  get iotStatusTopic() {
    return this.$iotStatusTopic;
  }

  get ingestStateMachine() {
    return this.$ingestStateMachine;
  }

  get metadataStateMachine() {
    return this.$metadataStateMachine;
  }

  get table() {
    return this.$configDB.Table;
  }

  get partition() {
    return this.$configDB.PartitionKey;
  }

  get item() {
    return this.$configDB.Item;
  }

  get assetTable() {
    return this.$assetDB.Table;
  }

  get assetPartitionKey() {
    return this.$assetDB.PartitionKey;
  }

  get mediainfoTable() {
    return this.$mediainfoDB.Table;
  }

  get mediainfoPartitionKey() {
    return this.$mediainfoDB.PartitionKey;
  }

  get apiGatewayEndpoint() {
    return this.$apiGatewayEndpoint;
  }

  get glacierBucket() {
    return this.$glacierBucket;
  }

  get proxyBucket() {
    return this.$proxyBucket;
  }

  get iotHost() {
    return this.$iotHost;
  }

  get mediaConvertServiceRole() {
    return this.$mediaConvertServiceRole;
  }

  get mediaConvertEndpoint() {
    return this.$mediaConvertEndpoint;
  }

  /* media-analytics-solution */
  get analytics() {
    return this.$analytics;
  }

  get analyticsBucket() {
    return this.$analytics.Bucket;
  }

  get analyticsApiEndpoint() {
    return this.$analytics.ApiEndpoint;
  }

  get analyticsStateMachine() {
    return this.$analytics.StateMachine;
  }

  get snsTopic() {
    return this.$snsTopic;
  }

  toJSON() {
    return this.$rawData;
  }

  /**
   * @function loadFromDB
   * @description load configuration from DB
   * @param {string} Table
   * @param {string} PartitionKey
   * @param {string} [ItemKey]
   */
  static async loadFromDB(Table, PartitionKey, ItemKey) {
    const db = new DB({
      Table,
      PartitionKey,
    });

    const response = await db.fetch(ItemKey);

    return new DBConfig(response);
  }
}

module.exports = {
  DBConfig,
};

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    DBConfig,
  });
