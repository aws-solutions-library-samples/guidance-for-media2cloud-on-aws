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
const PATH = require('path');

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

class AnalysisOp extends BaseOp {
  async onGET() {
    const uuid = (this.request.pathParameters || {}).uuid;

    if (!uuid || !CommonUtils.validateUuid(uuid)) {
      throw new Error('invalid uuid');
    }

    /* #1: check types of analysis */
    let db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    const types = await db.fetch(uuid, undefined, 'analysis');

    /* #2: query all types of analysis */
    db = new DB({
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    });
    let responses = await Promise.all(((types || {}).analysis || []).map(x =>
      db.fetch(uuid, x)));

    /* #3: load vtt and metadata tracks */
    responses = await Promise.all(responses.map((x) => {
      switch (x.type) {
        case 'video':
          return this.loadVideoTracks(x);
        case 'audio':
          return this.loadAudioTracks(x);
        case 'image':
          return this.loadImageTracks(x);
        case 'document':
          return this.loadDocumentTracks(x);
        default:
          return undefined;
      }
    }));
    return super.onGET(responses.filter(x => x));
  }

  async onPOST() {
    const params = this.request.body;

    if (!params.uuid || !CommonUtils.validateUuid(params.uuid)) {
      throw new Error('invalid uuid');
    }

    const arn = [
      'arn:aws:states',
      process.env.AWS_REGION,
      this.request.accountId,
      'stateMachine',
      Environment.StateMachines.Analysis,
    ].join(':');

    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    const response = await step.startExecution({
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

    let db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    const fetched = await db.fetch(uuid, undefined, [
      'analysis',
      'key',
    ]);

    if (!((fetched || {}).analysis || []).length) {
      return super.onDELETE({
        uuid,
        status: StateData.Statuses.NoData,
      });
    }

    let promises = [];
    /* #1: drop analysis attribute */
    promises.push(db.dropColumns(uuid, undefined, 'analysis').catch(() => undefined));

    /* #2: delete all aiml rows */
    db = new DB({
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    });
    promises = promises.concat(fetched.analysis.map(x =>
      db.purge(uuid, x).catch(() => undefined)));

    /* #3: remove all analysis results */
    let prefix = PATH.parse(fetched.key).dir;
    prefix = PATH.join(uuid, prefix, 'analysis');

    const files =
      await CommonUtils.listObjects(Environment.Proxy.Bucket, prefix).catch(() => []);
    promises = promises.concat(files.map(x =>
      CommonUtils.deleteObject(Environment.Proxy.Bucket, x.Key).catch(() => undefined)));

    /* #4: remove index from search engine */
    promises.push((new BaseIndex()).deleteDocument(uuid).catch(() => undefined));

    await Promise.all(promises);

    return super.onDELETE(Object.assign({
      uuid,
      status: StateData.Statuses.Removed,
    }, fetched));
  }

  async loadTrackBasenames(bucket, prefix) {
    if (!bucket || !prefix) {
      return undefined;
    }
    const responses = await CommonUtils.listObjects(bucket, prefix);
    return responses.map(x =>
      PATH.parse(x.Key).name);
  }

  async loadTracks(data) {
    const keys = Object.keys(data || {});
    let results;

    while (keys.length) {
      const key = keys.shift();
      const responses = await Promise.all([
        data[key].metadata,
        data[key].vtt,
      ].map((x) => {
        if (!x || PATH.parse(x).ext.length > 0) {
          return undefined;
        }
        return this.loadTrackBasenames(Environment.Proxy.Bucket, x);
      }));

      results = Object.assign({
        [key]: {
          trackBasenames: {
            metadata: responses[0],
            vtt: responses[1],
          },
        },
      }, results);
    }
    return results;
  }

  async loadVideoTracks(data) {
    const results = await this.loadTracks(data.rekognition);
    Object.keys(data.rekognition || {}).forEach((x) => {
      data.rekognition[x] = Object.assign(data.rekognition[x], results[x]);
    });
    return data;
  }

  async loadAudioTracks(data) {
    const results = await this.loadTracks(data.comprehend);
    Object.keys(data.comprehend || {}).forEach((x) => {
      data.comprehend[x] = Object.assign(data.comprehend[x], results[x]);
    });
    return data;
  }

  async loadImageTracks(data) {
    return data;
  }

  async loadDocumentTracks(data) {
    const results = await this.loadTracks(data.texttract);
    Object.keys(data.texttract || {}).forEach((x) => {
      data.texttract[x] = Object.assign(data.texttract[x], results[x]);
    });
    return data;
  }
}

module.exports = {
  AnalysisOp,
};
