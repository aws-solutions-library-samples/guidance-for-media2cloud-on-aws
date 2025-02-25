// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  RekognitionClient,
  ListCollectionsCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand,
  DeleteCollectionCommand,
  ListFacesCommand,
  DeleteFacesCommand,
  DescribeProjectsCommand,
  DescribeProjectVersionsCommand,
} = require('@aws-sdk/client-rekognition');
const PATH = require('path');
const {
  Environment: {
    Solution: {
      Metrics: {
        CustomUserAgent,
      },
    },
    Proxy: {
      Bucket: ProxyBucket,
    },
  },
  ApiOps: {
    FaceIndexer: OP_FACEINDEXER,
  },
  CommonUtils,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');
const BaseOp = require('./baseOp');

/* Face Collection */
const OP_FACECOLLECTIONS = 'face-collections';
const OP_FACECOLLECTION = 'face-collection';
const OP_FACES = 'faces';
const OP_FACE = 'face';
/* Custom Labels */
const OP_CUSTOMLABELS = 'custom-label-models';
const PROJECT_CREATED = 'CREATED';
const PROJECT_VERSIONS_INVALID_STATUS = [
  'TRAINING_FAILED',
  'FAILED',
  'DELETING',
];
// misc.
const DEFAULT_PAGESIZE = 100;
const PREFIX_FACECOLLECTION = 'face-collection';

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

async function _describeCollection(collectionId) {
  const command = new DescribeCollectionCommand({
    CollectionId: collectionId,
  });

  return _runCommand(command)
    .then((res) => ({
      name: collectionId,
      faces: res.FaceCount,
      modelVersion: res.FaceModelVersion,
      creationDate: new Date(res.CreationTimestamp),
    }))
    .catch(() =>
      undefined);
}

class RekognitionOp extends BaseOp {
  async onPOST() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_FACECOLLECTION) {
      return super.onPOST(await this.onPostFaceCollection());
    }
    if (op === OP_FACE) {
      throw new M2CException(`Deprecated. Use /${OP_FACEINDEXER} instead.`);
    }
    throw new M2CException('invalid operation');
  }

  async onDELETE() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_FACECOLLECTION) {
      return super.onDELETE(await this.onDeleteFaceCollection());
    }
    if (op === OP_FACE) {
      throw new M2CException(`Deprecated. Use /${OP_FACEINDEXER} instead.`);
    }
    throw new M2CException('invalid operation');
  }

  async onGET() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_FACECOLLECTIONS) {
      return super.onGET(await this.onGetFaceCollections());
    }
    if (op === OP_FACECOLLECTION) {
      return super.onGET(await this.onGetFaceCollection());
    }
    if (op === OP_FACES) {
      throw new M2CException(`Deprecated. Use /${OP_FACEINDEXER} instead.`);
      // return super.onGET(await this.onGetFaces());
    }
    if (op === OP_FACE) {
      throw new M2CException(`Deprecated. Use /${OP_FACEINDEXER} instead.`);
      // return super.onGET(await this.onGetFace());
    }
    if (op === OP_CUSTOMLABELS) {
      return super.onGET(await this.onGetCustomLabelModels());
    }
    throw new M2CException('invalid operation');
  }

  async onGetFaceCollections() {
    let response;
    let command;
    let collectionIds = [];
    do {
      command = new ListCollectionsCommand({
        MaxResults: 20,
        NextToken: (response || {}).NextToken,
      });

      response = await _runCommand(command)
        .catch(() =>
          undefined);

      if (response && response.CollectionIds.length) {
        const responses = await Promise.all(response.CollectionIds
          .map((collectionId) =>
            _describeCollection(collectionId)));

        collectionIds = collectionIds
          .concat(responses
            .filter((x) =>
              x));
      }
    } while ((response || {}).NextToken);

    return collectionIds;
  }

  async onGetFaceCollection() {
    const qs = this.request.queryString || {};
    if (!CommonUtils.validateFaceCollectionId(qs.collectionId)) {
      throw new M2CException('invalid collection id');
    }

    return _describeCollection(qs.collectionId);
  }

  async onPostFaceCollection() {
    const {
      collectionId,
    } = this.request.body || {};

    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collection id');
    }

    const command = new CreateCollectionCommand({
      CollectionId: collectionId,
    });

    return _runCommand(command)
      .then((res) => ({
        name: collectionId,
        faces: 0,
        modelVersion: res.FaceModelVersion,
        creationDate: new Date(),
      }))
      .catch((e) => ({
        errorCode: e.name,
        errorMessage: e.message,
      }));
  }

  async onDeleteFaceCollection() {
    const {
      collectionId,
    } = this.request.queryString || {};

    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collection id');
    }

    const command = new DeleteCollectionCommand({
      CollectionId: collectionId,
    });

    return _runCommand(command)
      .then((res) => ({
        statusCode: res.StatusCode,
      }))
      .catch((e) => ({
        errorCode: e.name,
        errorMessage: e.message,
      }));
  }

  async onGetFaces() {
    const qs = this.request.queryString || {};

    const collectionId = qs.collectionId;
    const token = qs.token && decodeURIComponent(qs.token);
    const pageSize = Number(qs.pageSize || DEFAULT_PAGESIZE);
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collection id');
    }

    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new ListFacesCommand({
      CollectionId: collectionId,
      MaxResults: pageSize,
      NextToken: token,
    });

    const responses = await rekognitionClient.send(command)
      .then((res) => ({
        faces: res.Faces
          .map((x) => ({
            externalImageId: x.ExternalImageId,
            faceId: x.FaceId,
          })),
        token: res.NextToken,
      }))
      .catch(() => ({
        faces: [],
      }));

    /* check if face images are stored in Proxy bucket */
    if (responses.faces.length) {
      const bucket = ProxyBucket;
      responses.faces = await Promise.all(responses.faces
        .map((face) => {
          // eslint-disable-next-line
          // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          const key = PATH.join(PREFIX_FACECOLLECTION, collectionId, `${face.faceId}.png`);
          return CommonUtils.headObject(bucket, key)
            .then(() => ({
              ...face,
              key,
            }))
            .catch(() =>
              face);
        }));
    }

    return responses;
  }

  async onGetFace() {
    const {
      collectionId,
      faceId,
    } = this.request.queryString || {};
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collection id');
    }
    if (!CommonUtils.validateUuid(faceId)) {
      throw new M2CException('invalid face id');
    }

    let command;
    let response;
    do {
      const rekognitionClient = xraysdkHelper(new RekognitionClient({
        customUserAgent: CustomUserAgent,
        retryStrategy: retryStrategyHelper(),
      }));

      command = new ListFacesCommand({
        CollectionId: collectionId,
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      });

      response = await rekognitionClient.send(command)
        .catch(() =>
          undefined);

      const found = ((response || {}).Faces || [])
        .find((x) =>
          x.FaceId === faceId);

      if (found) {
        const bucket = ProxyBucket;
        const key = PATH.join(
          PREFIX_FACECOLLECTION,
          collectionId,
          `${found.faceId}.png`
        );

        return {
          externalImageId: found.ExternalImageId,
          faceId: found.FaceId,
          key: await CommonUtils.headObject(bucket, key)
            .then((res) =>
              res.Key)
            .catch(() =>
              undefined),
        };
      }
    } while ((response || {}).NextToken);

    return {};
  }

  async onDeleteFace() {
    const {
      collectionId,
      faceId,
    } = this.request.queryString || {};
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new M2CException('invalid collection id');
    }
    if (!CommonUtils.validateUuid(faceId)) {
      throw new M2CException('invalid face id');
    }
    const bucket = ProxyBucket;
    const key = PATH.join(
      PREFIX_FACECOLLECTION,
      collectionId,
      `${faceId}.png`
    );

    const promises = [];

    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CustomUserAgent,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = new DeleteFacesCommand({
      CollectionId: collectionId,
      FaceIds: [
        faceId,
      ],
    });

    promises.push(rekognitionClient.send(command)
      .catch(() =>
        undefined));

    promises.push(CommonUtils.deleteObject(bucket, key)
      .catch(() =>
        undefined));

    return Promise.all(promises)
      .then(() => ({
        faceId,
      }));
  }

  async onGetCustomLabelModels() {
    let command;
    let response;
    let projectArns = [];

    do {
      const rekognitionClient = xraysdkHelper(new RekognitionClient({
        customUserAgent: CustomUserAgent,
        retryStrategy: retryStrategyHelper(),
      }));

      command = new DescribeProjectsCommand({
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      });

      response = await rekognitionClient.send(command)
        .catch(() =>
          undefined);

      if (response && response.ProjectDescriptions.length) {
        const filtered = response.ProjectDescriptions
          .filter((x) =>
            x.Status === PROJECT_CREATED)
          .map((x) => ({
            name: x.ProjectArn,
          }));

        projectArns = projectArns.concat(filtered);
      }
    } while ((response || {}).NextToken);

    /* make sure there are runnable project versions */
    await Promise.all(projectArns
      .map((projectArn) => {
        const rekognitionClient = xraysdkHelper(new RekognitionClient({
          customUserAgent: CustomUserAgent,
          retryStrategy: retryStrategyHelper(),
        }));

        command = new DescribeProjectVersionsCommand({
          ProjectArn: projectArn.name,
          MaxResults: 100,
        });

        return rekognitionClient.send(command)
          .then((res) => {
            const canUse = res.ProjectVersionDescriptions
              .find((x0) =>
                PROJECT_VERSIONS_INVALID_STATUS
                  .find((x1) =>
                    x1 === x0.Status) === undefined) !== undefined;
            projectArn.canUse = !!(canUse);
          })
          .catch(() => {
            projectArn.canUse = false;
          });
      }));

    return projectArns
      .map((x) => ({
        ...x,
        name: x.name.substring(x.name.indexOf('/') + 1),
      }));
  }
}

module.exports = RekognitionOp;
