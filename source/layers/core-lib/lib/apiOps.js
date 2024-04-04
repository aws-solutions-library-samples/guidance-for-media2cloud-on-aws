// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
   * @description get a list of rekognition face collections
   * /rekognition/face-collections
   * method: GET
   */
  FaceCollections: 'rekognition/face-collections',

  /**
    * @description get a list of rekognition face collections
    * /rekognition/face-collection?collectionId=<Name>&maxResults=<Number>
    * method: GET, POST, DELETE
    */
  FaceCollection: 'rekognition/face-collection',

  /**
   * @description get a list of rekognition face collections
   * /rekognition/faces
   * method: GET
   */
  Faces: 'rekognition/faces',

  /**
    * @description get a list of rekognition face collections
    * /rekognition/face?collectionId=<CollectionId>&faceId=<FaceId>
    * method: GET, POST, DELETE
    */
  Face: 'rekognition/face',

  /**
   * @description get a list of rekognition custom labels models
   * /rekognition/custom-label-models
   * method: GET
   */
  CustomLabelModels: 'rekognition/custom-label-models',

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

  /**
   * @description get a list of cognito users
   * /users
   * method: GET
   */
  Users: 'users',

  /**
   * @description manage ai/ml options settings
   * /settings/aioptions
   * method: GET, POST, DELETE
   */
  AIOptionsSettings: 'settings/aioptions',

  /**
   * @description GenAI use cases
   * /genai/*
   * method: POST
   */
  Tokenize: 'genai/tokenize',
  Genre: 'genai/genre',
  Sentiment: 'genai/sentiment',
  Summarize: 'genai/summarize',
  Taxonomy: 'genai/taxonomy',
  Theme: 'genai/theme',
  TVRatings: 'genai/tvratings',
  Custom: 'genai/custom',

  /**
   * @description FaceIndexer use cases
   * /faceindexer
   * method: GET, POST
   */
  FaceIndexer: 'faceindexer',
};
