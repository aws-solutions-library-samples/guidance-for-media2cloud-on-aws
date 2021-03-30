// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const Retry = require('./retry');
const Statuses = require('./statuses');
const {
  DynamoDB: {
    Stats: DDB,
  },
} = require('./environment');

const TABLE = DDB.Table;
const PARTITION = DDB.PartitionKey;
const KEY_TOTALDURATIONINSEC = 'totalDurationInSec';
const KEY_TOTALSIZEINKB = 'totalSizeInKB';
const KEY_TOTALCOUNT = 'totalCount';
const KEY_COMPLETEDCOUNT = 'completedCount';
const KEY_ERRORCOUNT = 'errorCount';

/* | type | totalDurationInSec | totalCount | completedCount | errorCount | totalSizeInKB */
class StatsDB {
  static getDocumentClient() {
    return new AWS.DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
    });
  }

  static async addItem(item) {
    return StatsDB.updateItem(item);
  }

  static async removeItem(item) {
    return StatsDB.updateItem(item, true);
  }

  static async updateItem(item, removed = false) {
    const attributeUpdates = {};
    if (!TABLE || !PARTITION) {
      throw new Error('missing environment variable');
    }
    if (!item[PARTITION]) {
      throw new Error(`missing item.${PARTITION}`);
    }
    if (!item.overallStatus) {
      throw new Error('missing item.overallStatus');
    }
    if (item.duration) {
      const value = Math.round(item.duration / 1000);
      attributeUpdates[KEY_TOTALDURATIONINSEC] = {
        Action: 'ADD',
        Value: (removed) ? (0 - value) : value,
      };
    }
    if (item.fileSize) {
      const value = Math.round(item.fileSize / 1000);
      attributeUpdates[KEY_TOTALSIZEINKB] = {
        Action: 'ADD',
        Value: (removed) ? (0 - value) : value,
      };
    }
    if (item.overallStatus === Statuses.Completed) {
      attributeUpdates[KEY_COMPLETEDCOUNT] = {
        Action: 'ADD',
        Value: (removed) ? -1 : 1,
      };
    } else if (item.overallStatus === Statuses.Error) {
      attributeUpdates[KEY_ERRORCOUNT] = {
        Action: 'ADD',
        Value: (removed) ? -1 : 1,
      };
    }
    attributeUpdates[KEY_TOTALCOUNT] = {
      Action: 'ADD',
      Value: (removed) ? -1 : 1,
    };
    const params = {
      TableName: TABLE,
      Key: {
        [PARTITION]: item[PARTITION],
      },
      AttributeUpdates: attributeUpdates,
      ReturnValues: 'ALL_NEW',
    };
    const db = StatsDB.getDocumentClient();
    return Retry.run(db.update.bind(db), params);
  }

  static async scanAll() {
    const params = {
      TableName: TABLE,
      Select: 'ALL_ATTRIBUTES',
    };
    const db = StatsDB.getDocumentClient();
    return Retry.run(db.scan.bind(db), params)
      .then(data => data.Items);
  }
}

module.exports = StatsDB;
