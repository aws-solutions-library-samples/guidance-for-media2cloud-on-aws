// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = (() => {
  try {
    const AWSXRay = require('aws-xray-sdk');
    return AWSXRay.captureAWS(require('aws-sdk'));
  } catch (e) {
    return require('aws-sdk');
  }
})();
const PATH = require('path');
const {
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
const CATEGORY_COMPREHEND = 'comprehend';

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
    const input = (this.request.body || {}).input || {};
    const uuid = input.uuid || (this.request.pathParameters || {}).uuid;
    if (!uuid || !CommonUtils.validateUuid(uuid)) {
      throw new Error('invalid uuid');
    }
    /* get original settings from db table */
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    const fieldsToGet = [
      'bucket',
      'key',
      'destination',
      'attributes',
      'aiOptions',
    ];
    const original = await db.fetch(uuid, undefined, fieldsToGet);
    /* drop analysis field to trigger clean up logic */
    await db.dropColumns(uuid, undefined, 'analysis')
      .catch(() =>
        undefined);

    /* determine if we need to re-run ingest workflow */
    /* if framebased or customlabel is enabled OR frameCaptureMode has changed */
    if (input.aiOptions === undefined) {
      input.aiOptions = original.aiOptions;
    }
    const ingestRequired = this.enableIngest(original.aiOptions, input.aiOptions);
    const stateMachine = (ingestRequired)
      ? Environment.StateMachines.Main
      : Environment.StateMachines.Analysis;
    const arn = [
      'arn:aws:states',
      process.env.AWS_REGION,
      this.request.accountId,
      'stateMachine',
      stateMachine,
    ].join(':');
    const params = {
      input: {
        uuid,
        ...original,
        aiOptions: input.aiOptions,
      },
      uuid,
    };
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
    const response = await step.startExecution({
      input: JSON.stringify(params),
      stateMachineArn: arn,
    }).promise();

    /* update aiOptions field */
    await db.update(uuid, undefined, {
      aiOptions: input.aiOptions,
    }, false);

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
    /* drop analysis column */
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    await db.dropColumns(uuid, undefined, 'analysis')
      .catch(() =>
        undefined);
    return super.onDELETE({
      uuid,
      status: StateData.Statuses.Removed,
    });
  }

  enableIngest(original, requested) {
    if (!original.framebased && requested.framebased) {
      return true;
    }
    if (!original.customlabel && requested.customlabel) {
      return true;
    }
    if ((requested.framebased || requested.customlabel)
      && original.frameCaptureMode !== requested.frameCaptureMode) {
      return true;
    }
    return false;
  }

  async loadTrackBasenames(bucket, prefix) {
    const names = [];
    if (!bucket || !prefix || PATH.parse(prefix).ext.length > 0) {
      return undefined;
    }
    let response;
    do {
      response = await CommonUtils.listObjects(bucket, prefix, {
        ContinuationToken: (response || {}).NextContinuationToken,
        MaxKeys: 300,
      }).catch((e) =>
        console.error(`[ERR]: CommonUtils.listObjects: ${prefix} ${e.code} ${e.message}`));
      if (response && response.Contents) {
        names.splice(names.length, 0, ...response.Contents.map((x) =>
          PATH.parse(x.Key).name));
      }
    } while ((response || {}).NextContinuationToken);
    return names.length > 0
      ? names
      : undefined;
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
