/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
module.exports = {
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
   * @deprecated
   * @description manage face collection
   * /face-collection/{collectionId}?token={token}&pageSize={number}
   * method: GET, POST, DELETE
   */
  FaceCollection: 'face-collection',

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

  /**
   * @description get a list of rekognition face collections
   * /rekognition/face-collections
   * method: GET
   */
  FaceCollections: 'rekognition/face-collections',

  /**
   * @description get a list of rekognition custom labels models
   * /rekognition/custom-label-models
   * method: GET
   */
  CustomLabelModels: 'rekognitin/custom-label-models',

  /**
   * @description get a list of transcribe custom vocabularies
   * /comprehend/custom-vocabularies
   * method: GET
   */
  CustomVocabularies: 'transcribe/custom-vocabularies',

  /**
   * @description get a list of transcribe custom language models
   * /transcribe/custom-language-models
   * method: GET
   */
  CustomLanguageModels: 'transcribe/custom-language-models',

  /**
   * @description get a list of comprehend entity recognizers
   * /comprehend/custom-entity-recognizers
   * method: GET
   */
  CustomEntityRecognizers: 'comprehend/custom-entity-recognizers',

  /**
   * @description get stats
   * /stats
   * method: GET
   */
  Stats: 'stats',
};
