// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  parse,
  join,
} = require('node:path');
const {
  RekognitionClient,
  ListFacesCommand,
  DeleteFacesCommand,
} = require('@aws-sdk/client-rekognition');
const {
  SFNClient,
  StartExecutionCommand,
} = require('@aws-sdk/client-sfn');
const {
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
    StateMachines: {
      UpdateFaceIndexer,
    },
    Proxy: {
      Bucket: ProxyBucket,
    },
  },
  ApiOps: {
    FaceIndexer: OP_FACEINDEXER,
  },
  AnalysisTypes: {
    AutoFaceIndexer,
  },
  FaceIndexer,
  FaceIndexerDefs: {
    Actions: {
      Deleting,
    },
  },
  CommonUtils,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

const REGION = process.env.AWS_REGION;

const DEFAULT_PAGESIZE = 100;
const SUBOP_UPDATE = 'update';
const SUBOP_INDEX = 'index';
const SUBOP_IMPORT = 'import';

async function _storeFaceS3(
  faceId,
  bucket,
  prefix,
  image
) {
  let name = faceId.replaceAll('-', '');
  name = `${name}.jpg`;

  return CommonUtils.uploadFile(
    bucket,
    prefix,
    name,
    image
  ).then(() =>
    join(prefix, name));
}

async function _runCommand(command) {
  const rekognitionClient = xraysdkHelper(new RekognitionClient({
    customUserAgent: CustomUserAgent,
    retryStrategy: retryStrategyHelper(),
  }));

  return rekognitionClient.send(command)
    .then((res) => {
      delete res.$metadata;
      return res;
    })
    .catch((e) => {
      console.warn(
        'WARN:',
        'FaceIndexer._runCommand:',
        `${command.constructor.name}:`,
        e.$metadata.httpStatusCode,
        e.name,
        e.message,
        JSON.stringify(command.input)
      );
      throw e;
    });
}

class FaceIndexerOp extends BaseOp {
  async onGET() {
    let promise;

    const op = this.request.pathParameters.operation;
    if (op === OP_FACEINDEXER) {
      const qs = this.request.queryString || {};
      if (qs.collectionId) {
        promise = this.onGetFacesByCollection();
      } else if (qs.faceIds) {
        promise = this.onBatchGetFaces();
      } else if (qs.faceId) {
        promise = this.onGetFace();
      }
    }

    if (!promise) {
      throw new M2CException('invalid operation');
    }

    return super.onGET(await promise);
  }

  async onPOST() {
    const op = this.request.pathParameters.operation;
    const subop = this.request.pathParameters.uuid;

    let promise;

    if (op === OP_FACEINDEXER) {
      if (subop === SUBOP_UPDATE) {
        promise = this.onUpdateFaceTaggings();
      } else if (subop === SUBOP_INDEX) {
        promise = this.onIndexFaces();
      } else if (subop === SUBOP_IMPORT) {
        promise = this.onImportFaces();
      }
    }

    if (promise === undefined) {
      throw new M2CException('invalid operation');
    }

    promise = await promise;
    return super.onPOST(promise);
  }

  async onDELETE() {
    let promise;
    const op = this.request.pathParameters.operation;

    if (op === OP_FACEINDEXER) {
      promise = this.onDeleteFace();
    }

    if (promise === undefined) {
      throw new M2CException('invalid operation');
    }

    return super.onDELETE(await promise);
  }

  async onGetFacesByCollection() {
    const qs = this.request.queryString || {};

    let collectionId = qs.collectionId;
    if (collectionId) {
      collectionId = decodeURIComponent(collectionId);
    }

    if (!collectionId || !CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collection id');
    }

    // token and pageSize?
    let token = qs.token;
    if (token) {
      token = decodeURIComponent(token);
    }

    const pageSize = Number(qs.pageSize || DEFAULT_PAGESIZE);

    const command = new ListFacesCommand({
      CollectionId: collectionId,
      MaxResults: pageSize,
      NextToken: token,
    });

    const response = await _runCommand(command)
      .then((res) => ({
        token: res.NextToken,
        faces: res.Faces
          .reduce((a0, c0) => ({
            ...a0,
            [c0.FaceId]: {
              faceId: c0.FaceId,
              externalImageId: c0.ExternalImageId,
            },
          }), {}),
      }))
      .catch(() => ({
        faces: {},
      }));

    const faceIds = Object.keys(response.faces);
    if (faceIds.length === 0) {
      return {
        faces: [],
      };
    }

    // get details from faceindexer table
    const faceIndexer = new FaceIndexer();

    await faceIndexer.batchGet(faceIds)
      .then((res) => {
        res.forEach((face) => {
          response.faces[face.faceId] = face;
        });
      });

    response.faces = Object.values(response.faces);

    return response;
  }

  async onBatchGetFaces() {
    const qs = this.request.queryString || {};

    let faceIds = qs.faceIds;
    if (!faceIds) {
      throw new M2CException('invalid faceIds');
    }

    faceIds = decodeURIComponent(faceIds).split(',');

    const faceIndexer = new FaceIndexer();
    return faceIndexer.batchGet(faceIds);
  }

  async onGetFace() {
    const qs = this.request.queryString || {};

    let faceId = qs.faceId;
    if (faceId) {
      faceId = decodeURIComponent(faceId);
    }

    if (!faceId || !CommonUtils.validateUuid(faceId)) {
      throw new M2CException('invalid faceId');
    }

    const faceIndexer = new FaceIndexer();
    return faceIndexer.batchGet([faceId])
      .then((res) =>
        (res || [])[0]);
  }

  async onIndexFaces() {
    const { blob, bucket, key } = this.request.body || {};

    // start face indexing state machine
    if (bucket && key) {
      const parsed = parse(key);
      if (parsed.ext === '.json') {
        const params = {
          bucket,
          prefix: parsed.dir,
          output: parsed.base,
        };

        return await this.startFaceIndexingJob(params);
      }
    }

    // index face from blob (single image)
    if (blob !== undefined) {
      return await this.onIndexFaceFromBlob();
    }

    throw new M2CException('invalid face indexing request');
  }

  async onIndexFaceFromBlob() {
    const {
      uuid,
      timestamp,
      collectionId,
      celeb,
      blob,
    } = this.request.body || {};

    if (!CommonUtils.validateUuid(uuid)) {
      throw new M2CException('invalid uuid');
    }
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collectionId');
    }
    if (!CommonUtils.validateCharacterSet(celeb)) {
      throw new M2CException('invalid celeb');
    }
    if (!CommonUtils.validateImageBlob(blob)) {
      throw new M2CException('invalid blob');
    }

    let _timestamp = 0;
    if (typeof timestamp === 'number' && timestamp > 0) {
      _timestamp = timestamp;
    }

    let bytes = blob.replace(/^data:image\/\w+;base64,/, '');
    bytes = Buffer.from(bytes, 'base64');

    const externalImageId = FaceIndexer.createExternalImageId(
      uuid,
      _timestamp
    );

    const faceIndexer = new FaceIndexer();

    const indexed = await faceIndexer.indexFaces(
      collectionId,
      externalImageId,
      bytes,
      1
    );

    if (!indexed || !indexed.FaceRecords || !indexed.FaceRecords.length) {
      return undefined;
    }

    const faceId = indexed.FaceRecords[0].Face.FaceId;
    const userId = indexed.FaceRecords[0].Face.UserId;
    const prefix = join(AutoFaceIndexer, collectionId);

    const key = await _storeFaceS3(
      faceId,
      ProxyBucket,
      prefix,
      bytes
    );

    const fields = {
      uuid,
      collectionId,
      externalImageId,
      celeb,
      userId,
      key,
    };

    return faceIndexer.registerFace(faceId, fields)
      .then(() =>
        fields);
  }

  async onUpdateFaceTaggings() {
    const prioritizedUuid = (this.request.queryString || {}).uuid;
    if (prioritizedUuid !== undefined
      && !CommonUtils.validateUuid(prioritizedUuid)) {
      throw new M2CException('invalid uuid');
    }

    const items = this.request.body || [];
    const faceIndexer = new FaceIndexer();

    const response = await faceIndexer.batchUpdate(items);

    // minmize the input parameters to the state machine
    const deleted = (response.deleted || [])
      .map((item) => ({
        faceId: item.faceId,
        celeb: item.celeb,
      }));
    const updated = (response.updated || [])
      .map((item) => ({
        faceId: item.faceId,
        celeb: item.celeb,
        updateFrom: item.updateFrom,
      }));

    if ((deleted.length + updated.length) > 0) {
      // state machine to perform full update
      const changeset = {
        deleted,
        updated,
      };
      await this.startUpdateJob(changeset, prioritizedUuid);
    }

    return response;
  }

  async startUpdateJob(changeset, prioritizedUuid) {
    const params = {
      input: {
        action: SUBOP_UPDATE,
        ...changeset,
        prioritizedUuid,
      },
    };

    return this.startExecution(params);
  }

  async startImportJob(collectionId, token) {
    const params = {
      input: {
        action: SUBOP_IMPORT,
        collectionId,
        token,
      },
    };

    return this.startExecution(params);
  }

  async startFaceIndexingJob(data) {
    const params = {
      input: {
        action: SUBOP_INDEX,
        ...data,
      },
      data: {},
    };

    return this.startExecution(params);
  }

  async startExecution(params) {
    const arn = [
      'arn:aws:states',
      REGION,
      this.request.accountId,
      'stateMachine',
      UpdateFaceIndexer,
    ].join(':');

    const stepfunctionClient = xraysdkHelper(new SFNClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new StartExecutionCommand({
      input: JSON.stringify(params),
      stateMachineArn: arn,
    });

    return stepfunctionClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }));
  }

  async onImportFaces() {
    const {
      collectionId,
    } = this.request.body || {};

    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collectionId');
    }

    const faceIndexer = new FaceIndexer();
    const response = await faceIndexer.importFaces(collectionId);

    if (response.token !== undefined) {
      await this.startImportJob(collectionId, response.token);
    }

    return response;
  }

  async onDeleteFace() {
    const {
      faceId,
      collectionId,
    } = this.request.queryString || {};

    if (!faceId || !CommonUtils.validateUuid(faceId)) {
      throw new M2CException('invalid face id');
    }

    // check to see if the faceid is managed by indexer
    const faceIndexer = new FaceIndexer();

    let items = await faceIndexer.batchGet([faceId]);

    if (items.length > 0) {
      items = [{
        faceId,
        action: Deleting,
      }];

      return faceIndexer.batchUpdate(items);
    }

    // otherwise, fall back to deleting it from rekognition collection
    let _collectionId = collectionId;
    if (_collectionId) {
      _collectionId = decodeURIComponent(_collectionId);
    }
    if (!_collectionId || !CommonUtils.validateFaceCollectionId(_collectionId)) {
      throw new M2CException('invalid collection id');
    }

    const command = new DeleteFacesCommand({
      CollectionId: collectionId,
      FaceIds: [
        faceId,
      ],
    });

    return _runCommand(command)
      .then((res) => ({
        deleted: res.DeletedFaces
          .map((id) => ({
            faceId: id,
          })),
      }));
  }
}

module.exports = FaceIndexerOp;
