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
const {
  ApiOps,
  DB,
  Environment,
  FaceCollection,
  CommonUtils,
} = require('m2c-core-lib');

const {
  BaseOp,
} = require('./baseOp');


class FaceCollectionOp extends BaseOp {
  async onGET() {
    const operation = (this.request.pathParameters || {}).operation;

    if (operation === ApiOps.FaceColection) {
      return this.onGetFaceCollection();
    } else if (operation === ApiOps.IndexFace) {
      return this.onGetIndexedFaces();
    } else if (operation === ApiOps.QueueFace) {
      return this.onGetQueuedFaces();
    }
    throw new Error('GET invalid operation');
  }

  async onPOST() {
    const operation = (this.request.pathParameters || {}).operation;

    if (operation === ApiOps.FaceColection) {
      return this.onPostFaceCollection();
    } else if (operation === ApiOps.IndexFace) {
      return this.onPostIndexedFaces();
    } else if (operation === ApiOps.QueueFace) {
      return this.onPostQueuedFaces();
    }
    throw new Error('POST invalid operation');
  }

  async onDELETE() {
    const operation = (this.request.pathParameters || {}).operation;

    if (operation === ApiOps.FaceColection) {
      return this.onDeleteFaceCollection();
    } else if (operation === ApiOps.IndexFace) {
      return this.onDeleteIndexedFaces();
    } else if (operation === ApiOps.QueueFace) {
      return this.onDeleteQueuedFaces();
    }
    throw new Error('DELETE invalid operation');
  }

  async onGetFaceCollection() {
    const collectionId = (this.request.pathParameters || {}).uuid;

    let {
      token,
      pageSize,
    } = this.request.queryString || {};

    token = token && decodeURIComponent(token);

    if (!collectionId || !CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new Error('invalid collection id');
    }

    if (token && !CommonUtils.validateBase64JsonToken(token)) {
      throw new Error('invalid token');
    }

    pageSize = Number.parseInt(pageSize || Environment.DynamoDB.Ingest.GSI.PageSize, 10);

    const response = await FaceCollection.getFaces(collectionId, {
      token,
      pageSize,
    });

    const db = new DB({
      Table: Environment.DynamoDB.IndexedFaces.Table,
      PartitionKey: Environment.DynamoDB.IndexedFaces.PartitionKey,
      SortKey: Environment.DynamoDB.IndexedFaces.SortKey,
    });

    const items = await Promise.all(((response || {}).Faces || []).map(x =>
      db.fetch(x.ExternalImageId, x.FaceId, [
        'dataUrl',
        'uuid',
      ]).catch(() => undefined)));

    return super.onGET({
      token: response.NextToken,
      items: items.filter(x => x),
    });
  }

  async onGetIndexedFaces() {
    const uuid = (this.request.pathParameters || {}).uuid;
    /* if uuid not specified, scan all records */
    if (uuid && !CommonUtils.validateUuid(uuid)) {
      throw new Error('invalid uuid');
    }
    return super.onGET(await FaceCollection.scanIndexedFaces(uuid));
  }

  async onGetQueuedFaces() {
    const uuid = (this.request.pathParameters || {}).uuid;
    /* if uuid not specified, scan all records */
    if (uuid && !CommonUtils.validateUuid(uuid)) {
      throw new Error('invalid uuid');
    }
    return super.onGET(await FaceCollection.scanQueuedFaces(uuid));
  }

  async onPostFaceCollection() {
    throw new Error('POST face collection not supported');
  }

  async onPostIndexedFaces() {
    const data = this.request.body;

    if (!data.blob || !data.name) {
      throw new Error('blob and name must not be null');
    }

    if (!CommonUtils.validateImageBlob(data.blob)) {
      throw new Error('invalid blob');
    }

    if (!CommonUtils.validateImageBlob(data.dataUrl)) {
      throw new Error('invalid dataUrl');
    }

    if (!CommonUtils.validateUuid(data.uuid)) {
      throw new Error('invalid uuid');
    }

    if (!CommonUtils.validateS3Uri(data.contentUrl)) {
      throw new Error('invalid contentUrl');
    }

    const id = (this.request.pathParameters || {}).uuid
      || data.collectionId
      || Environment.Rekognition.CollectionId;

    if (!id || !CommonUtils.validateFaceCollectionId(id)) {
      throw new Error('invalid collection id');
    }

    const indexer = new FaceCollection(id, data);
    return super.onPOST(await indexer.indexNow());
  }

  async onPostQueuedFaces() {
    const data = this.request.body;

    if (!data.blob || !data.tempId || !data.dataUrl) {
      throw new Error('blob and tempId must not be null');
    }

    if (!CommonUtils.validateUuid(data.tempId)) {
      throw new Error('invalid tempId');
    }

    if (!CommonUtils.validateImageBlob(data.blob)) {
      throw new Error('invalid blob');
    }

    if (!CommonUtils.validateImageBlob(data.dataUrl)) {
      throw new Error('invalid dataUrl');
    }

    if (!CommonUtils.validateUuid(data.uuid)) {
      throw new Error('invalid uuid');
    }

    if (!CommonUtils.validateS3Uri(data.contentUrl)) {
      throw new Error('invalid contentUrl');
    }

    const id = (this.request.pathParameters || {}).uuid
      || data.collectionId
      || Environment.Rekognition.CollectionId;

    if (!id || !CommonUtils.validateFaceCollectionId(id)) {
      throw new Error('invalid collection id');
    }

    const indexer = new FaceCollection(id, data);
    return super.onPOST(await indexer.queueNow());
  }

  async onDeleteFaceCollection() {
    const collectionId = (this.request.pathParameters || {}).uuid;
    if (!collectionId || !CommonUtils.validateFaceCollectionId(collectionId)) {
      throw new Error('invalid collection id');
    }
    return super.onDELETE(await FaceCollection.purgeCollection(collectionId));
  }

  async onDeleteIndexedFaces() {
    const {
      name,
      faceId,
      faceCollectionId,
    } = this.request.queryString || {};

    if (!name || !faceId) {
      throw new Error('missing name or faceId querystring');
    }

    if (!CommonUtils.validateUuid(faceId)) {
      throw new Error('invalid faceId');
    }

    const id = (this.request.pathParameters || {}).uuid
      || faceCollectionId
      || Environment.Rekognition.CollectionId;

    if (!id || !CommonUtils.validateFaceCollectionId(id)) {
      throw new Error('invalid collection id');
    }

    return super.onDELETE(await FaceCollection.purgeIndexedFace(id, name, faceId));
  }

  async onDeleteQueuedFaces() {
    const id = (this.request.pathParameters || {}).uuid
      || (this.request.queryString || {}).tempId;

    if (!id || !CommonUtils.validateUuid(id)) {
      throw new Error('invalid tempId');
    }

    return super.onDELETE(await FaceCollection.purgeQueuedFace(id));
  }
}

module.exports = {
  FaceCollectionOp,
};
