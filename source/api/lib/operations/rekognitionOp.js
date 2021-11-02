// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0

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
  Environment,
  CommonUtils,
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
/* misc. */
const DEFAULT_PAGESIZE = 100;
const PREFIX_FACECOLLECTION = 'face-collection';

class RekognitionOp extends BaseOp {
  static createInstance() {
    return new AWS.Rekognition({
      apiVersion: '2016-06-27',
      customUserAgent: Environment.Solution.Metrics.CustomUserAgent,
    });
  }

  async onPOST() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_FACECOLLECTION) {
      return super.onPOST(await this.onPostFaceCollection());
    }
    if (op === OP_FACE) {
      return super.onPOST(await this.onPostFace());
    }
    throw new Error('RekognitionOp.onPOST not impl');
  }

  async onDELETE() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_FACECOLLECTION) {
      return super.onDELETE(await this.onDeleteFaceCollection());
    }
    if (op === OP_FACE) {
      return super.onDELETE(await this.onDeleteFace());
    }
    throw new Error('RekognitionOp.onDELETE not impl');
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
      return super.onGET(await this.onGetFaces());
    }
    if (op === OP_FACE) {
      return super.onGET(await this.onGetFace());
    }
    if (op === OP_CUSTOMLABELS) {
      return super.onGET(await this.onGetCustomLabelModels());
    }
    throw new Error('invalid operation');
  }

  async onGetFaceCollections() {
    const rekog = RekognitionOp.createInstance();

    let response;
    const collectionIds = [];
    do {
      response = await rekog.listCollections({
        MaxResults: 20,
        NextToken: (response || {}).NextToken,
      }).promise()
        .catch(() => undefined);
      if (response && response.CollectionIds.length) {
        const responses = await Promise.all(response.CollectionIds.map((x) =>
          rekog.describeCollection({
            CollectionId: x,
          }).promise()
            .then((res) => ({
              name: x,
              faces: res.FaceCount,
              modelVersion: res.FaceModelVersion,
              creationDate: new Date(res.CreationTimestamp),
            }))
            .catch(() => undefined)));
        collectionIds.splice(collectionIds.length, 0, ...responses.filter((x) => x));
      }
    } while ((response || {}).NextToken);
    return collectionIds;
  }

  async onGetFaceCollection() {
    const qs = this.request.queryString || {};
    if (!CommonUtils.validateFaceCollectionId(qs.collectionId)) {
      throw new Error('invalid collection id');
    }
    const rekog = RekognitionOp.createInstance();
    return rekog.describeCollection({
      CollectionId: qs.collectionId,
    }).promise()
      .then((res) => ({
        name: qs.collectionId,
        faces: res.FaceCount,
        modelVersion: res.FaceModelVersion,
        creationDate: new Date(res.CreationTimestamp),
      }));
  }

  async onPostFaceCollection() {
    const params = this.request.body || {};
    const collectionId = params.collectionId;
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new Error('invalid collection id');
    }
    const rekog = RekognitionOp.createInstance();
    return rekog.createCollection({
      CollectionId: collectionId,
    }).promise()
      .then((res) => ({
        name: collectionId,
        faces: 0,
        modelVersion: res.FaceModelVersion,
        creationDate: new Date(),
      }))
      .catch((e) => ({
        errorCode: e.code,
        errorMessage: e.message,
      }));
  }

  async onDeleteFaceCollection() {
    const qs = this.request.queryString || {};
    const collectionId = qs.collectionId;
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new Error('invalid collection id');
    }
    const rekog = RekognitionOp.createInstance();
    return rekog.deleteCollection({
      CollectionId: collectionId,
    }).promise()
      .then((res) => ({
        statusCode: res.StatusCode,
      }))
      .catch((e) => ({
        errorCode: e.code,
        errorMessage: e.message,
      }));
  }

  async onGetFaces() {
    const qs = this.request.queryString || {};
    const collectionId = qs.collectionId;
    const token = qs.token && decodeURIComponent(qs.token);
    const pageSize = Number(qs.pageSize || DEFAULT_PAGESIZE);
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new Error('invalid collection id');
    }
    const rekog = RekognitionOp.createInstance();
    const responses = await rekog.listFaces({
      CollectionId: collectionId,
      MaxResults: pageSize,
      NextToken: token,
    }).promise()
      .then((res) => ({
        faces: res.Faces.map((x) => ({
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
      const bucket = Environment.Proxy.Bucket;
      responses.faces = await Promise.all(responses.faces.map((face) => {
        const key = PATH.join(PREFIX_FACECOLLECTION, collectionId, `${face.faceId}.png`);
        return CommonUtils.headObject(bucket, key)
          .then(() => ({
            ...face,
            key,
          }))
          .catch(() => face);
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
      throw new Error('invalid collection id');
    }
    if (!CommonUtils.validateUuid(faceId)) {
      throw new Error('invalid face id');
    }
    let response;
    const rekog = RekognitionOp.createInstance();
    do {
      response = await rekog.listFaces({
        CollectionId: collectionId,
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      }).promise()
        .catch(() => undefined);
      const found = ((response || {}).Faces || []).find((x) =>
        x.FaceId === faceId);
      if (found) {
        const bucket = Environment.Proxy.Bucket;
        const key = PATH.join(PREFIX_FACECOLLECTION, collectionId, `${found.faceId}.png`);
        return {
          externalImageId: found.ExternalImageId,
          faceId: found.FaceId,
          key: await CommonUtils.headObject(bucket, key)
            .then((res) => res.Key)
            .catch(() => undefined),
        };
      }
    } while ((response || {}).NextToken);
    return {};
  }

  async onPostFace() {
    const {
      collectionId,
      blob,
      externalImageId,
    } = this.request.body || {};
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new Error('invalid collection id');
    }
    if (!CommonUtils.validateFaceCollectionId(externalImageId)) {
      throw new Error('invalid external image id');
    }
    if (!CommonUtils.validateImageBlob(blob)) {
      throw new Error('invalid blob');
    }
    const buf = Buffer.from(blob.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const rekog = RekognitionOp.createInstance();
    const response = await rekog.indexFaces({
      CollectionId: collectionId,
      ExternalImageId: externalImageId,
      Image: {
        Bytes: buf,
      },
      DetectionAttributes: [
        'DEFAULT',
      ],
      MaxFaces: 1,
      QualityFilter: 'AUTO',
    }).promise()
      .then((res) => ({
        externalImageId: res.FaceRecords[0].Face.ExternalImageId,
        faceId: res.FaceRecords[0].Face.FaceId,
      }))
      .catch((e) => ({
        errorCode: e.code,
        errorMessage: e.message,
      }));
    if ((response || {}).faceId) {
      const bucket = Environment.Proxy.Bucket;
      const prefix = PATH.join(PREFIX_FACECOLLECTION, collectionId);
      const name = `${response.faceId}.png`;
      const key = await CommonUtils.uploadFile(bucket, prefix, name, buf)
        .then(() => PATH.join(prefix, name))
        .catch(() => undefined);
      response.key = key;
    }
    return response;
  }

  async onDeleteFace() {
    const {
      collectionId,
      faceId,
    } = this.request.queryString || {};
    if (!CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new Error('invalid collection id');
    }
    if (!CommonUtils.validateUuid(faceId)) {
      throw new Error('invalid face id');
    }
    const bucket = Environment.Proxy.Bucket;
    const key = PATH.join(PREFIX_FACECOLLECTION, collectionId, `${faceId}.png`);
    const rekog = RekognitionOp.createInstance();
    return Promise.all([
      rekog.deleteFaces({
        CollectionId: collectionId,
        FaceIds: [
          faceId,
        ],
      }).promise()
        .catch(() => undefined),
      CommonUtils.deleteObject(bucket, key)
        .catch(() => undefined),
    ]).then(() => ({
      faceId,
    }));
  }

  async onGetCustomLabelModels() {
    const rekog = RekognitionOp.createInstance();

    let response;
    const projectArns = [];
    do {
      response = await rekog.describeProjects({
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      }).promise().catch(() => undefined);
      if (response && response.ProjectDescriptions.length) {
        const filtered = response.ProjectDescriptions
          .filter(x => x.Status === PROJECT_CREATED)
          .map(x => ({
            name: x.ProjectArn,
          }));
        projectArns.splice(projectArns.length, 0, ...filtered);
      }
    } while ((response || {}).NextToken);
    /* make sure there are runnable project versions */
    await Promise.all(projectArns.map(projectArn =>
      rekog.describeProjectVersions({
        ProjectArn: projectArn.name,
        MaxResults: 100,
      }).promise().then(data => {
        const canUse = data.ProjectVersionDescriptions.find(x0 =>
          PROJECT_VERSIONS_INVALID_STATUS.find(x1 =>
            x1 === x0.Status) === undefined) !== undefined;
        projectArn.canUse = !!(canUse);
      }).catch(() => {
        projectArn.canUse = false;
      })));
    return projectArns.map(x => ({
      ...x,
      name: x.name.substring(x.name.indexOf('/') + 1),
    }));
  }
}

module.exports = RekognitionOp;
