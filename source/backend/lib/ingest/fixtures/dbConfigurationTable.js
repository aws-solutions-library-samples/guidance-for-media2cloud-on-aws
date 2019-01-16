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
 * @description mock DynamoDB configuration table
 */

const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

module.exports = {
  Analytics: {
    ApiEndpoint: 'https://x.execute-api.region.amazonaws.com/prod',
    Bucket: 'proxy-bucket',
    StateMachine: 'media-analysis',
  },
  ApiGatewayEndpoint: 'https://x.execute-api.region.amazonaws.com/demo',
  AssetDB: {
    PartitionKey: 'UUID',
    Table: 'Asset',
  },
  ConfigDB: {
    Item: 'configuration',
    PartitionKey: 'Item',
    Table: 'Configuration',
  },
  GlacierBucket: 'glacier-bucket',
  IngestStateMachine: 'ingest-statemachine',
  IotHost: 'x-ats.iot.region.amazonaws.com',
  IotStatusTopic: 'mock/status',
  Item: 'configuration',
  MediaConvertEndpoint: 'https://x.mediaconvert.region.amazonaws.com',
  MediaConvertServiceRole: `arn:aws:iam::${X.zeroAccountId()}:role/mediaconvert-service-role`,
  MediainfoDB: {
    PartitionKey: 'UUID',
    Table: 'Mediainfo',
  },
  MetadataStateMachine: 'metadata-statemachine',
  ProxyBucket: 'proxy-bucket',
  Region: 'region',
  SNSTopic: `arn:aws:sns:region:${X.zeroAccountId()}:topic`,
};
