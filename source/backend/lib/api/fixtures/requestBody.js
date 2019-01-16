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
 * @description mock API request body
 */
const {
  mxCommonUtils,
} = require('../../shared/mxCommonUtils');

class X extends mxCommonUtils(class {}) {}

module.exports = {
  State: 's3',
  Status: 'OBJECTCREATED',
  Progress: 100,
  StateMachine: 'ingest-statemachine',
  Timestamp: new Date().toISOString(),
  Data: {
    UUID: X.zeroUUID(),
    Glacier: {
      Bucket: 'glacier-bucket',
      Key: 'mock/archive-definition.json',
      MD5: X.zeroMD5(),
      LastModified: new Date().getTime(),
      ContentLength: 890,
      ContentType: 'application/json',
      System: 'DIVA',
      Description: 'Not specified',
      Comments: 'No comments',
      Category: 'mock',
      Name: 'mock',
      Barcode: '000',
      Files: [],
      ArchiveDate: new Date().toISOString(),
    },
  },
  Config: {
    MediaConvertEndpoint: 'https://x.mediaconvert.region.amazonaws.com',
    IotHost: 'x-ats.iot.region.amazonaws.com',
    Item: 'configuration',
    IotStatusTopic: 'mock/status',
    Region: 'region',
    IngestStateMachine: 'ingest-statemachine',
    ConfigDB: {
      PartitionKey: 'Item',
      Item: 'configuration',
      Table: 'mock-Configuration',
    },
    MediaConvertServiceRole: `arn:aws:iam::${X.zeroAccountId()}:role/mock-mediaconvert-role`,
    MetadataStateMachine: 'mock-metadata-statemachine',
    ApiGatewayEndpoint: 'https://x.execute-api.region.amazonaws.com/demo',
    Analytics: {
      Bucket: 'proxy-bucket',
      ApiEndpoint: 'https://x.execute-api.region.amazonaws.com/prod',
      StateMachine: 'mock-media-analysis',
    },
    SNSTopic: `arn:aws:sns:region:${X.zeroAccountId()}:mock`,
    AssetDB: {
      PartitionKey: 'UUID',
      Table: 'mock-Asset',
    },
    GlacierBucket: 'x880-glacier',
    MediainfoDB: {
      PartitionKey: 'UUID',
      Table: 'mock-Mediainfo',
    },
    ProxyBucket: 'proxy-bucket',
  },
  DataInTransit: {
  },
};
