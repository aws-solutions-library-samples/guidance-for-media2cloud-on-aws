/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
const AWS = require('aws-sdk');

const {
  BaseIndex,
  CommonUtils,
  DB,
  Environment,
  StateData,
} = require('m2c-core-lib');

const {
  BaseOp,
} = require('./baseOp');

class AssetOp extends BaseOp {
  async onGET() {
    const uuid = (this.request.pathParameters || {}).uuid;
    /* uuid can be null (meant scanning asset table) */
    if (uuid && !CommonUtils.validateUuid(uuid)) {
      throw new Error('invalid uuid');
    }

    let {
      token,
      pageSize,
    } = this.request.queryString || {};

    token = token && decodeURIComponent(token);
    if (token && !CommonUtils.validateBase64JsonToken(token)) {
      throw new Error('invalid token');
    }

    pageSize = Number.parseInt(pageSize || Environment.DynamoDB.Ingest.GSI.PageSize, 10);

    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });

    const response = (uuid)
      ? await db.fetch(uuid)
      : await db.scanIndex({
        Name: Environment.DynamoDB.Ingest.GSI.Name,
        Key: Environment.DynamoDB.Ingest.GSI.Key,
        Value: Environment.DynamoDB.Ingest.GSI.Value,
        PageSize: pageSize,
        Ascending: false,
        Token: token,
      });
    return super.onGET(response);
  }

  async onPOST() {
    let params = this.request.body || {};
    if (!(params.uuid || (params.bucket && params.key))) {
      throw new Error('uuid or bucket and key must be specified');
    }

    if (params.uuid && !CommonUtils.validateUuid(params.uuid)) {
      throw new Error('invalid uuid');
    }

    if (params.bucket && !CommonUtils.validateBucket(params.bucket)) {
      throw new Error('invalid bucket name');
    }

    /* #1: make sure there is no uuid collision */
    let fetched;
    if (params.uuid) {
      const db = new DB({
        Table: Environment.DynamoDB.Ingest.Table,
        PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
      });
      fetched = await db.fetch(params.uuid, undefined, 'key').catch(() => undefined);

      if (params.key && (fetched || {}).key && params.key !== fetched.key) {
        throw new Error(`${params.uuid} is already used for other asset`);
      }
    }

    /* #2: make sure s3 object exists */
    const uuid = params.uuid || CommonUtils.uuid4();
    const bucket = params.bucket || Environment.Ingest.Bucket;
    const key = params.key || (fetched || {}).key;

    let response = await CommonUtils.headObject(bucket, key);

    /* #3: start ingest state machine */
    const arn = [
      'arn:aws:states',
      process.env.AWS_REGION,
      this.request.accountId,
      'stateMachine',
      Environment.StateMachines.Ingest,
    ].join(':');

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    params = Object.assign({}, {
      uuid,
      bucket,
      key,
    }, params);

    response = await step.startExecution({
      input: JSON.stringify(params),
      stateMachineArn: arn,
    }).promise();

    return super.onPOST(Object.assign({
      uuid: params.uuid,
      status: StateData.Statuses.Started,
    }, response));
  }

  async onDELETE() {
    const uuid = (this.request.pathParameters || {}).uuid;

    if (!uuid || !CommonUtils.validateUuid(uuid)) {
      throw new Error('invalid uuid');
    }

    let promises = [];
    /* #1: remove proxy files */
    const responses = await CommonUtils.listObjects(Environment.Proxy.Bucket, uuid);
    promises = promises.concat(responses.map(x =>
      CommonUtils.deleteObject(Environment.Proxy.Bucket, x.Key).catch(() => undefined)));

    /* #2: remove row from ingest table */
    let db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });

    const fetched = await db.fetch(uuid, undefined, 'analysis');
    promises.push(db.purge(uuid).catch(() => undefined));

    /* #3: remove rows from aiml table */
    db = new DB({
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    });
    promises = promises.concat(((fetched || {}).analysis || []).map(x =>
      db.purge(uuid, x).catch(() => undefined)));

    /* #4: remove index from search engine */
    promises.push((new BaseIndex()).deleteDocument(uuid).catch(e =>
      console.log(`deleteDocument(${uuid}): ${e.message}`)));

    await Promise.all(promises);

    return super.onDELETE({
      uuid,
      status: StateData.Statuses.Removed,
    });
  }
}

module.exports = {
  AssetOp,
};
