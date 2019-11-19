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
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */

const endpoints = {
  /**
   * @description manage asset
   * /assets?token={string}&pageSize={number}
   * method: GET
   *
   * /asssets/{uuid+}
   * method: GET, POST, DELETE
   */
  Assets: 'assets',

  /**
   * @description manage asset aiml result
   * /analysis/{uuid}
   * method: GET, POST, DELETE
   */
  Analysis: 'analysis',

  /**
   * @description start labeling job
   * /labeling
   * method: POST
   */
  Labeling: 'labeling',

  /**
   * @description manage workteam members
   * /workteam/{teamName}?member={string}
   * method: GET, POST, DELETE
   */
  Workteam: 'workteam',

  /**
   * @description manage face collection
   * /face-collection/{collectionId}?token={token}&pageSize={number}
   * method: GET, POST, DELETE
   */
  FaceColection: 'face-collection',

  /**
   * @description manage index faces
   * /index-face/{collectionId+} (GET)
   */
  IndexFace: 'index-face',

  /**
   * @description manage index faces
   * /queue-face/{collectionId+} (GET)
   */
  QueueFace: 'queue-face',

  /**
   * @description search results on Elasticsearch
   * /search?query={term}&token={string}&size={number}
   * method: GET
   */
  Search: 'search',

  /**
   * @description get execution status
   * /execution?executionArn={executionArn}
   * method: GET
   */
  Execution: 'execution',

  /**
   * @description bind policy to iot
   * /attach-policy
   * method: POST
   */
  AttachPolicy: 'attach-policy',

  /**
   * @description edit specific label
   * /edit-label
   * method: POST
   */
  EditLabel: 'edit-label',
};

module.exports = endpoints;

/**
 * @description expose classess to window globals
 */
global.AWSomeNamespace =
  Object.assign(global.AWSomeNamespace || {}, {
    ApiOps: endpoints,
  });
