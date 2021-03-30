/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const PATH = require('path');
const {
  BaseIndex,
  CommonUtils,
  DB,
  Environment,
  StateData,
} = require('core-lib');
const BaseOp = require('./baseOp');

const MEDIATYPE_VIDEO = 'video';
const MEDIATYPE_AUDIO = 'audio';
const MEDIATYPE_IMAGE = 'image';
const MEDIATYPE_DOCUMENT = 'document';
const TRACK_METADATA = 'metadata';
const TRACK_TIMESERIES = 'timeseries';
const TRACK_VTT = 'vtt';
const CATEGORY_REKOGNITION = 'rekognition';
const CATEGORY_TEXTRACT = 'textract';
const CATEGORY_COMPREHEND = 'comprehend';
const CATEGORY_TRANSCRIBE = 'transcribe';

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
    const types = await db.fetch(uuid, undefined, 'analysis')
      .catch(() => ({
        analysis: [],
      }));
    /* #2: query all types of analysis */
    db = new DB({
      Table: Environment.DynamoDB.AIML.Table,
      PartitionKey: Environment.DynamoDB.AIML.PartitionKey,
      SortKey: Environment.DynamoDB.AIML.SortKey,
    });
    let responses = await Promise.all(types.analysis.map(x =>
      db.fetch(uuid, x)));
    /* #3: load vtt and metadata tracks */
    responses = await Promise.all((responses || []).map(x => (
      (x.type === MEDIATYPE_VIDEO)
        ? this.loadVideoTracks(x)
        : (x.type === MEDIATYPE_AUDIO)
          ? this.loadAudioTracks(x)
          : (x.type === MEDIATYPE_IMAGE)
            ? this.loadImageTracks(x)
            : (x.type === MEDIATYPE_DOCUMENT)
              ? this.loadDocumentTracks(x)
              : undefined
    )));
    return super.onGET(responses.filter(x => x));
  }

  async onPOST() {
    const params = this.request.body;

    if (!params.uuid || !CommonUtils.validateUuid(params.uuid)) {
      throw new Error('invalid uuid');
    }

    if (!params.input) {
      params.input = {};
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

    return super.onPOST({
      uuid: params.uuid,
      status: StateData.Statuses.Started,
      ...response,
    });
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

    return super.onDELETE({
      uuid,
      status: StateData.Statuses.Removed,
      ...fetched,
    });
  }

  async loadTrackBasenames(bucket, prefix) {
    if (!bucket || !prefix || PATH.parse(prefix).ext.length > 0) {
      return undefined;
    }
    return CommonUtils.listObjects(bucket, PATH.join(prefix, '/'))
      .then(data => data.map(x => PATH.parse(x.Key).name));
  }

  async loadTracks(data, category) {
    const bucket = Environment.Proxy.Bucket;
    const keys = Object.keys(data[category] || {});
    while (keys.length) {
      const key = keys.shift();
      const datasets = [].concat(data[category][key]);
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        const tracks = await Promise.all([
          TRACK_METADATA,
          TRACK_TIMESERIES,
          TRACK_VTT,
        ].map(x => this.loadTrackBasenames(bucket, dataset[x])));
        dataset.trackBasenames = {
          [TRACK_METADATA]: tracks[0],
          [TRACK_TIMESERIES]: tracks[1],
          [TRACK_VTT]: tracks[2],
        };
      }
    }
    return data;
  }

  async loadVideoTracks(data) {
    return this.loadTracks(data, CATEGORY_REKOGNITION);
  }

  async loadAudioTracks(data) {
    return this.loadTracks(data, CATEGORY_COMPREHEND);
  }

  async loadDocumentTracks(data) {
    return data;
  }

  async loadImageTracks(data) {
    return data;
  }
}

module.exports = AnalysisOp;
