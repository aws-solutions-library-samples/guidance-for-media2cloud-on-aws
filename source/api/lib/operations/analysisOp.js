// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  SFNClient,
  StartExecutionCommand,
} = require('@aws-sdk/client-sfn');
const {
  CommonUtils,
  DB,
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
    DynamoDB: {
      Ingest: {
        Table: IngestTable,
        PartitionKey: IngestPartitionKey,
      },
      AIML: {
        Table: AnalysisTable,
        PartitionKey: AnalysisPartitionKey,
        SortKey: AnalysisSortKey,
      },
      Shoppable: {
        Table: ShoppableTable,
        PartitionKey: ShoppablePartitionKey,
      },
    },
    StateMachines: {
      Main: MainStateMachine,
      Analysis: AnalysisStateMachine,
    },
    Proxy: {
      Bucket: ProxyBucket,
    },
  },
  AnalysisTypes: {
    Shoppable,
  },
  StateData,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const MEDIATYPE_VIDEO = 'video';
const TRACK_METADATA = 'metadata';
const TRACK_TIMESERIES = 'timeseries';
const TRACK_VTT = 'vtt';
const CATEGORY_REKOGNITION = 'rekognition';
const CATEGORY_COMPREHEND = 'comprehend';

const REGION = process.env.AWS_REGION;

class AnalysisOp extends BaseOp {
  async onGET() {
    const uuid = (this.request.pathParameters || {}).uuid;
    if (!uuid || !CommonUtils.validateUuid(uuid)) {
      throw new M2CException('invalid uuid');
    }

    // #1: check types of analysis
    let db = new DB({
      Table: IngestTable,
      PartitionKey: IngestPartitionKey,
    });

    const types = await db.fetch(uuid, undefined, ['analysis', 'aiOptions'])
      .catch(() => ({
        analysis: [],
      }));

    // #2: query all types of analysis
    db = new DB({
      Table: AnalysisTable,
      PartitionKey: AnalysisPartitionKey,
      SortKey: AnalysisSortKey,
    });

    let responses = await Promise.all(types.analysis
      .map((type) =>
        db.fetch(uuid, type)));

    responses = responses
      .filter((response) =>
        response !== undefined);

    // #3: check shoppable
    if (types.analysis.includes(MEDIATYPE_VIDEO)
    && types.aiOptions[Shoppable] === true) {
      db = new DB({
        Table: ShoppableTable,
        PartitionKey: ShoppablePartitionKey,
      });

      await db.fetch(uuid, undefined)
        .then((res) => {
          if (res && res[Shoppable]) {
            responses.forEach((response) => {
              if (response[CATEGORY_REKOGNITION]) {
                response[CATEGORY_REKOGNITION][Shoppable] = res[Shoppable];
              }
            });
          }
        })
        .catch(() =>
          undefined);
    }

    return super.onGET(responses);
  }

  async onPOST() {
    const input = (this.request.body || {}).input || {};
    const uuid = input.uuid || (this.request.pathParameters || {}).uuid;
    if (!uuid || !CommonUtils.validateUuid(uuid)) {
      throw new M2CException('invalid uuid');
    }
    /* get original settings from db table */
    const db = new DB({
      Table: IngestTable,
      PartitionKey: IngestPartitionKey,
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
      ? MainStateMachine
      : AnalysisStateMachine;
    const arn = [
      'arn:aws:states',
      REGION,
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

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new StartExecutionCommand({
      input: JSON.stringify(params),
      stateMachineArn: arn,
    });

    const response = await stepfunctionClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));

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
      throw new M2CException('invalid uuid');
    }
    /* drop analysis column */
    const db = new DB({
      Table: IngestTable,
      PartitionKey: IngestPartitionKey,
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
      }).catch((e) => {
        console.error(
          'ERR:',
          'AnalysisOp.loadTrackBasenames:',
          'CommonUtils.listObjects:',
          e.name,
          e.message,
          prefix
        );
        return undefined;
      });

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
    const bucket = ProxyBucket;
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
