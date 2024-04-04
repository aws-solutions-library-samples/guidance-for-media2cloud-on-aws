// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  SFNClient,
  StartExecutionCommand,
} = require('@aws-sdk/client-sfn');
const {
  CommonUtils,
  DB,
  Environment,
  StateData,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const JsonProvider = require('./jsonProvider');
const BaseOp = require('./baseOp');

const REGION = process.env.AWS_REGION;
const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class AssetOp extends BaseOp {
  async onGET() {
    const uuid = (this.request.pathParameters || {}).uuid;
    /* get specific record */
    if (uuid) {
      return super.onGET(await this.onGetByUuid(uuid));
    }
    const qs = this.request.queryString || {};
    const token = qs.token && decodeURIComponent(qs.token);
    if (token && !CommonUtils.validateBase64JsonToken(token)) {
      throw new M2CException('invalid token');
    }
    const pageSize = Number(qs.pageSize || Environment.DynamoDB.Ingest.GSI.PageSize);
    const overallStatus = qs.overallStatus && decodeURIComponent(qs.overallStatus);
    const type = qs.type && decodeURIComponent(qs.type);
    /* get records by overallStatus */
    if (overallStatus) {
      return super.onGET(await this.onGetByOverallStatus(overallStatus, token, pageSize));
    }
    /* get records by specific type */
    if (type) {
      return super.onGET(await this.onGetByType(type, token, pageSize));
    }
    /* get all records */
    return super.onGET(await this.onGetAll(token, pageSize));
  }

  async onPOST() {
    const params = this.request.body || {};
    const input = params.input;
    if (!input) {
      throw new M2CException('input object must be specified');
    }
    if (!(input.uuid || (input.bucket && input.key))) {
      throw new M2CException('uuid or bucket and key must be specified');
    }
    if (input.uuid && !CommonUtils.validateUuid(input.uuid)) {
      throw new M2CException('invalid uuid');
    }
    if ((input.destination || {}).bucket && !CommonUtils.validateBucket(input.destination.bucket)) {
      throw new M2CException('invalid destination bucket name');
    }
    if ((input.group) && !CommonUtils.validateGroupName(input.group)) {
      throw new M2CException('invalid group name');
    }
    if (input.attributes !== undefined) {
      const keys = Object.keys(input.attributes);
      while (keys.length) {
        if (!CommonUtils.validateAttributeKey(keys.shift())) {
          throw new M2CException('invalid attribute key name');
        }
      }
      const values = Object.values(input.attributes);
      while (values.length) {
        if (!CommonUtils.validateAttributeValue(values.shift())) {
          throw new M2CException('invalid attribute key value');
        }
      }
    }
    /* if is JSON file, start batch ingest */
    const response = JsonProvider.isJsonFile(params.input.key)
      ? await this.batchStartIngestWorkflow(params)
      : await this.startIngestWorkflow(params);
    return super.onPOST(response);
  }

  async onDELETE() {
    const uuid = (this.request.pathParameters || {}).uuid;
    if (!uuid || !CommonUtils.validateUuid(uuid)) {
      throw new M2CException('invalid uuid');
    }

    /* start the removal state machine */
    await this.startAssetRemovalWorkflow(uuid);

    return super.onDELETE({
      uuid,
      status: StateData.Statuses.Removed,
    });
  }

  async batchStartIngestWorkflow(params) {
    const input = params.input;
    const provider = await JsonProvider.createProvider(input);
    provider.parse();
    const files = provider.getFiles().slice(0);

    return Promise.all(files.map(x =>
      this.startIngestWorkflow({
        input: {
          ...input,
          ...x,
          attributes: provider.attributes,
        },
      }).catch(e => ({
        uuid: x.uuid,
        status: StateData.Statuses.Error,
        errorMessage: e.message,
      }))));
  }

  async startIngestWorkflow(params) {
    const input = params.input;
    /* #1: make sure there is no uuid collision */
    let fetched;
    if (input.uuid) {
      const db = new DB({
        Table: Environment.DynamoDB.Ingest.Table,
        PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
      });
      fetched = await db.fetch(input.uuid, undefined, 'key').catch(() => ({}));

      if (input.key && fetched.key && input.key !== fetched.key) {
        throw new M2CException(`${input.uuid} is already used for other asset`);
      }
    } else {
      input.uuid = CommonUtils.uuid4();
    }
    /* #2: make sure s3 object exists */
    const bucket = input.bucket || Environment.Ingest.Bucket;
    const key = input.key || fetched.key;
    await CommonUtils.headObject(bucket, key);
    /* #3: make destination params */
    input.destination = {
      bucket: Environment.Proxy.Bucket,
      prefix: CommonUtils.makeSafeOutputPrefix(input.uuid, key),
      ...input.destination,
    };
    /* #4: start ingest state machine */
    const arn = [
      'arn:aws:states',
      REGION,
      this.request.accountId,
      'stateMachine',
      Environment.StateMachines.Main,
    ].join(':');

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new StartExecutionCommand({
      input: JSON.stringify({
        input,
      }),
      stateMachineArn: arn,
    });

    return stepfunctionClient.send(command)
      .then((res) => ({
        ...res,
        uuid: input.uuid,
        status: StateData.Statuses.Started,
        $metadata: undefined,
      }));
  }

  async startAssetRemovalWorkflow(uuid) {
    const params = {
      input: {
        uuid,
      },
    };

    const arn = [
      'arn:aws:states',
      REGION,
      this.request.accountId,
      'stateMachine',
      Environment.StateMachines.AssetRemoval,
    ].join(':');

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new StartExecutionCommand({
      input: JSON.stringify(params),
      stateMachineArn: arn,
    });

    return stepfunctionClient.send(command)
      .then((res) => ({
        ...res,
        uuid,
        status: StateData.Statuses.Removed,
        $metadata: undefined,
      }));
  }

  async onGetByUuid(uuid) {
    if (!CommonUtils.validateUuid(uuid)) {
      throw new M2CException('invalid uuid');
    }
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    return db.fetch(uuid);
  }

  async onGetByOverallStatus(overallStatus, token, pageSize) {
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    return db.scanIndex({
      Name: Environment.DynamoDB.Ingest.GSI.Status.Name,
      Key: Environment.DynamoDB.Ingest.GSI.Status.Key,
      Value: overallStatus,
      Token: token,
      PageSize: pageSize,
      Ascending: false,
    });
  }

  async onGetByType(type, token, pageSize) {
    const params = (type === 'group')
      ? {
        Name: Environment.DynamoDB.Ingest.GSI.Group.Name,
        Key: Environment.DynamoDB.Ingest.GSI.Group.Key,
      }
      : {
        Name: Environment.DynamoDB.Ingest.GSI.Type.Name,
        Key: Environment.DynamoDB.Ingest.GSI.Type.Key,
      };
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    return db.scanIndex({
      ...params,
      Value: type,
      Token: token,
      PageSize: pageSize,
      Ascending: false,
    });
  }

  async onGetAll(token, pageSize) {
    const db = new DB({
      Table: Environment.DynamoDB.Ingest.Table,
      PartitionKey: Environment.DynamoDB.Ingest.PartitionKey,
    });
    return db.scanIndex({
      Name: Environment.DynamoDB.Ingest.GSI.SchemaVersion.Name,
      Key: Environment.DynamoDB.Ingest.GSI.SchemaVersion.Key,
      Value: Environment.DynamoDB.Ingest.GSI.SchemaVersion.Value,
      Token: token,
      PageSize: pageSize,
      Ascending: false,
    });
  }
}

module.exports = AssetOp;
