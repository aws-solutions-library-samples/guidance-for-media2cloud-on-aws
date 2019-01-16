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
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
const {
  DynamoDB: {
    DocumentClient,
  },
} = require('aws-sdk');

const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

const REQUIRED_PROPERTIES = [
  'ServiceToken',
  'FunctionName',
  'MediaAnalysisBucket',
  'MediaAnalysisApiEndpoint',
  'MediaAnalysisStateMachineName',
  'Media2CloudEndpoint',
  'GlacierBucket',
  'IotHost',
  'IotTopic',
  'MediaConvertEndpoint',
  'MediaConvertRoleArn',
  'SNSTopicArn',
  'ConfigurationTableName',
  'ConfigurationPartitionKey',
  'ConfigurationItemName',
  'AssetTableName',
  'AssetPartitionKey',
  'MediainfoTableName',
  'MediainfoPartitionKey',
  'IngestStateMachine',
  'MetadataStateMachine',
];

/**
 * @function InitializeDB
 * @param {object} event
 * @param {object} context
 */
exports.InitializeDB = async (event, context) => {
  try {
    class X0 extends mxBaseResponse(class {}) {}
    const x0 = new X0(event, context);

    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const {
      ResourceProperties: Props = {},
    } = event || {};

    /* sanity check */
    const missing = REQUIRED_PROPERTIES.filter(x => Props[x] === undefined);

    if (missing.length) {
      throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
    }

    /* convert to DynamoDB payload */
    const document = {
      Region: process.env.AWS_REGION,
      Analytics: {
        ApiEndpoint: Props.MediaAnalysisApiEndpoint,
        Bucket: Props.MediaAnalysisBucket,
        StateMachine: Props.MediaAnalysisStateMachineName,
      },
      ApiGatewayEndpoint: Props.Media2CloudEndpoint,
      GlacierBucket: Props.GlacierBucket,
      IotHost: Props.IotHost,
      IotStatusTopic: Props.IotTopic,
      MediaConvertEndpoint: Props.MediaConvertEndpoint,
      MediaConvertServiceRole: Props.MediaConvertRoleArn,
      ProxyBucket: Props.MediaAnalysisBucket,
      SNSTopic: Props.SNSTopicArn,
      ConfigDB: {
        Table: Props.ConfigurationTableName,
        PartitionKey: Props.ConfigurationPartitionKey,
        Item: Props.ConfigurationItemName,
      },
      AssetDB: {
        Table: Props.AssetTableName,
        PartitionKey: Props.AssetPartitionKey,
      },
      MediainfoDB: {
        Table: Props.MediainfoTableName,
        PartitionKey: Props.MediainfoPartitionKey,
      },
      IngestStateMachine: Props.IngestStateMachine,
      MetadataStateMachine: Props.MetadataStateMachine,
    };

    const TableName = Props.ConfigurationTableName;

    const Key = {};
    Key[Props.ConfigurationPartitionKey] = Props.ConfigurationItemName;

    const AttributeUpdates = Object.keys(document).reduce((acc, cur) => {
      const item = {};

      item[cur] = {
        Action: 'PUT',
        Value: document[cur],
      };

      return Object.assign(acc, item);
    }, {});

    const params = {
      TableName,
      Key,
      AttributeUpdates,
    };

    const instance = new DocumentClient({
      apiVersion: '2012-08-10',
    });

    const response = await instance.update(params).promise();
    console.log(JSON.stringify(response, null, 2));

    x0.storeResponseData('Status', 'SUCCESS');

    return x0.responseData;
  } catch (e) {
    e.message = `InitializeDB: ${e.message}`;
    throw e;
  }
};
