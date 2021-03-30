/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const BaseOp = require('./baseOp');

const OP_FACECOLLECTIONS = 'face-collections';
const OP_CUSTOMLABELS = 'custom-label-models';
const PROJECT_CREATED = 'CREATED';
const PROJECT_VERSIONS_INVALID_STATUS = [
  'TRAINING_FAILED',
  'FAILED',
  'DELETING',
];

class RekognitionOp extends BaseOp {
  async onPOST() {
    throw new Error('RekognitionOp.onPOST not impl');
  }

  async onDELETE() {
    throw new Error('RekognitionOp.onDELETE not impl');
  }

  async onGET() {
    const op = this.request.pathParameters.uuid;
    if (op === OP_FACECOLLECTIONS) {
      return super.onGET(await this.onGetFaceCollections());
    }
    if (op === OP_CUSTOMLABELS) {
      return super.onGET(await this.onGetCustomLabelModels());
    }
    throw new Error('invalid operation');
  }

  async onGetFaceCollections() {
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });

    let response;
    const collectionIds = [];
    do {
      response = await rekog.listCollections({
        MaxResults: 100,
        NextToken: (response || {}).NextToken,
      }).promise().catch(() => undefined);
      if (response && response.CollectionIds.length) {
        collectionIds.splice(collectionIds.length, 0, ...response.CollectionIds.map(x => ({
          name: x,
        })));
      }
    } while ((response || {}).NextToken);
    /* check to see if collection contains faces */
    await Promise.all(collectionIds.map(x =>
      rekog.describeCollection({
        CollectionId: x.name,
      }).promise().then(data => {
        x.faceCount = data.FaceCount;
        x.canUse = data.FaceCount > 0;
      }).catch(() => {
        x.faceCount = 0;
        x.canUse = false;
      })));
    return collectionIds;
  }

  async onGetCustomLabelModels() {
    const rekog = new AWS.Rekognition({
      apiVersion: '2016-06-27',
    });

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
