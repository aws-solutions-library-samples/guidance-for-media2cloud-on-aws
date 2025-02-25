// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import AuthHttpRequest from './authHttpRequest.js';

const {
  ApiEndpoint,
  ApiOps,
  KnowledgeGraph,
  Shoppable,
} = SolutionManifest;

const ENDPOINTS = {
  Asset: `${ApiEndpoint}/${ApiOps.Assets}`,
  Analysis: `${ApiEndpoint}/${ApiOps.Analysis}`,
  Search: `${ApiEndpoint}/${ApiOps.Search}`,
  Execution: `${ApiEndpoint}/${ApiOps.Execution}`,
  AttachIot: `${ApiEndpoint}/${ApiOps.AttachPolicy}`,
  FaceCollections: `${ApiEndpoint}/${ApiOps.FaceCollections}`,
  FaceCollection: `${ApiEndpoint}/${ApiOps.FaceCollection}`,
  Faces: `${ApiEndpoint}/${ApiOps.Faces}`,
  Face: `${ApiEndpoint}/${ApiOps.Face}`,
  CustomLabelModels: `${ApiEndpoint}/${ApiOps.CustomLabelModels}`,
  CustomVocabularies: `${ApiEndpoint}/${ApiOps.CustomVocabularies}`,
  CustomLanguageModels: `${ApiEndpoint}/${ApiOps.CustomLanguageModels}`,
  CustomEntityRecognizers: `${ApiEndpoint}/${ApiOps.CustomEntityRecognizers}`,
  Stats: `${ApiEndpoint}/${ApiOps.Stats}`,
  Users: `${ApiEndpoint}/${ApiOps.Users}`,
  AIOptionsSettings: `${ApiEndpoint}/${ApiOps.AIOptionsSettings}`,
  FaceIndexer: `${ApiEndpoint}/${ApiOps.FaceIndexer}`,
  Tokenize: `${ApiEndpoint}/${ApiOps.Tokenize}`,
  Summarize: `${ApiEndpoint}/${ApiOps.Summarize}`,
  Genre: `${ApiEndpoint}/${ApiOps.Genre}`,
  Sentiment: `${ApiEndpoint}/${ApiOps.Sentiment}`,
  TVRatings: `${ApiEndpoint}/${ApiOps.TVRatings}`,
  Theme: `${ApiEndpoint}/${ApiOps.Theme}`,
  Taxonomy: `${ApiEndpoint}/${ApiOps.Taxonomy}`,
  Custom: `${ApiEndpoint}/${ApiOps.Custom}`,
  Workflow: `${ApiEndpoint}/${ApiOps.Execution}`,
};

let GRAPH_ENDPOINT;
let GRAPH_APIKEY;
if (KnowledgeGraph && KnowledgeGraph.Endpoint && KnowledgeGraph.ApiKey) {
  GRAPH_ENDPOINT = `${KnowledgeGraph.Endpoint}/graph`;
  GRAPH_APIKEY = KnowledgeGraph.ApiKey;
}

let SHOPPABLE_ENDPOINT;
let SHOPPABLE_APIKEY;
if (Shoppable && Shoppable.Endpoint && Shoppable.ApiKey) {
  SHOPPABLE_ENDPOINT = `${Shoppable.Endpoint}/shoppable`;
  SHOPPABLE_APIKEY = Shoppable.ApiKey;
}

const _authHttpRequest = new AuthHttpRequest();

export default class ApiHelper {
  /* record related methods */
  static async scanRecords(query) {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.Asset,
      query
    );
  }

  static async getRecord(uuid) {
    return _authHttpRequest.send(
      'GET',
      `${ENDPOINTS.Asset}/${uuid}`
    );
  }

  static async purgeRecord(uuid) {
    return _authHttpRequest.send(
      'DELETE',
      `${ENDPOINTS.Asset}/${uuid}`
    );
  }

  /* aiml results */
  static async getAnalysisResults(uuid) {
    return _authHttpRequest.send(
      'GET',
      `${ENDPOINTS.Analysis}/${uuid}`
    );
  }

  /* iot */
  static async attachIot() {
    return _authHttpRequest.send(
      'POST',
      ENDPOINTS.AttachIot
    );
  }

  /* search method */
  static async search(query) {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.Search,
      query
    );
  }

  static async searchInDocument(docId, query) {
    return _authHttpRequest.send(
      'GET',
      `${ENDPOINTS.Search}/${docId}`,
      query
    );
  }

  /* workflow related methods */
  static async startIngestWorkflow(body, query) {
    return _authHttpRequest.send(
      'POST',
      ENDPOINTS.Asset,
      query,
      body
    );
  }

  static async startAnalysisWorkflow(uuid, body, query) {
    return _authHttpRequest.send(
      'POST',
      `${ENDPOINTS.Analysis}/${uuid}`,
      query,
      body
    );
  }

  static async startWorkflow(body, query) {
    return _authHttpRequest.send(
      'POST',
      ENDPOINTS.Asset,
      query,
      body
    );
  }

  static async getRekognitionFaceCollections() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.FaceCollections
    );
  }

  static async getRekognitionCustomLabelModels() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.CustomLabelModels
    );
  }

  static async getTranscribeCustomVocabulary() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.CustomVocabularies
    );
  }

  static async getTranscribeCustomLanguageModels() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.CustomLanguageModels
    );
  }

  static async getComprehendCustomEntityRecognizers() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.CustomEntityRecognizers
    );
  }

  /* stats */
  static async getStats(query) {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.Stats,
      query
    );
  }

  /* face collection */
  static async getFaceCollections() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.FaceCollections
    );
  }

  static async createFaceCollection(collectionId) {
    return _authHttpRequest.send(
      'POST',
      ENDPOINTS.FaceCollection,
      undefined,
      {
        collectionId,
      }
    );
  }

  static async deleteFaceCollection(collectionId) {
    return _authHttpRequest.send(
      'DELETE',
      ENDPOINTS.FaceCollection,
      {
        collectionId,
      }
    );
  }

  static async getFacesInCollection(collectionId, options) {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.FaceIndexer,
      {
        ...options,
        collectionId,
      }
    );
  }

  static async deleteFaceFromCollection(collectionId, faceId) {
    return _authHttpRequest.send(
      'DELETE',
      ENDPOINTS.FaceIndexer,
      {
        collectionId,
        faceId,
      }
    );
  }

  /* user management */
  static async getUsers() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.Users
    );
  }

  static async addUsers(users) {
    return _authHttpRequest.send(
      'POST',
      ENDPOINTS.Users,
      undefined,
      users
    );
  }

  static async deleteUser(user) {
    return _authHttpRequest.send(
      'DELETE',
      ENDPOINTS.Users,
      {
        user,
      }
    );
  }

  /* manage aiOptions settings */
  static async getGlobalAIOptions() {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.AIOptionsSettings
    );
  }

  static async setGlobalAIOptions(aiOptions) {
    return _authHttpRequest.send(
      'POST',
      ENDPOINTS.AIOptionsSettings,
      undefined,
      aiOptions
    );
  }

  static async deleteGlobalAIOptions() {
    return _authHttpRequest.send(
      'DELETE',
      ENDPOINTS.AIOptionsSettings
    );
  }

  static async graph(query) {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': GRAPH_APIKEY,
    };

    let tries = 4;
    while (tries--) {
      try {
        const response = await _authHttpRequest.send(
          'GET',
          GRAPH_ENDPOINT,
          query,
          '',
          headers
        );
        return response;
      } catch (e) {
        console.log(`== ApiHelper.graph: #${tries}`);
        console.error(e);
      }
    }

    return undefined;
  }

  // FaceIndexer
  static async batchGetFaces(faceIds) {
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.FaceIndexer,
      {
        faceIds: faceIds.join(','),
      }
    );
  }

  static async updateFaceTaggings(faceTags, optionalUuid) {
    const query = {};

    if (optionalUuid) {
      query.uuid = optionalUuid;
    }

    return _authHttpRequest.send(
      'POST',
      `${ENDPOINTS.FaceIndexer}/update`,
      query,
      faceTags
    );
  }

  static async indexFaceV2(payload) {
    return _authHttpRequest.send(
      'POST',
      `${ENDPOINTS.FaceIndexer}/index`,
      undefined,
      payload
    );
  }

  static async importFaceCollection(payload) {
    return _authHttpRequest.send(
      'POST',
      `${ENDPOINTS.FaceIndexer}/import`,
      undefined,
      payload
    );
  }

  // GenAI use cases
  static async tokenize(options) {
    return _authHttpRequest.send(
      'POST',
      ENDPOINTS.Tokenize,
      undefined,
      options
    );
  }

  static async genaiPrompt(endpoint, options) {
    return _authHttpRequest.send(
      'POST',
      endpoint,
      undefined,
      options
    );
  }

  static async promptSummarize(options) {
    return ApiHelper.genaiPrompt(
      ENDPOINTS.Summarize,
      options
    );
  }

  static async promptGenre(options) {
    return ApiHelper.genaiPrompt(
      ENDPOINTS.Genre,
      options
    );
  }

  static async promptSentiment(options) {
    return ApiHelper.genaiPrompt(
      ENDPOINTS.Sentiment,
      options
    );
  }

  static async promptTVRatings(options) {
    return ApiHelper.genaiPrompt(
      ENDPOINTS.TVRatings,
      options
    );
  }

  static async promptTheme(options) {
    return ApiHelper.genaiPrompt(
      ENDPOINTS.Theme,
      options
    );
  }

  static async promptTaxonomy(options) {
    return ApiHelper.genaiPrompt(
      ENDPOINTS.Taxonomy,
      options
    );
  }

  static async promptCustom(options) {
    return ApiHelper.genaiPrompt(
      ENDPOINTS.Custom,
      options
    );
  }

  // shoppable backend api
  static async getProductDetails(query) {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': SHOPPABLE_APIKEY,
    };

    const _query = {
      op: 'GetProductDetails',
      ...query,
    };

    return _authHttpRequest.send(
      'GET',
      SHOPPABLE_ENDPOINT,
      _query,
      '',
      headers
    );
  }

  static async previewOrders(query, body) {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': SHOPPABLE_APIKEY,
    };

    const _query = {
      op: 'PreviewOrders',
      ...query,
    };

    return _authHttpRequest.send(
      'POST',
      SHOPPABLE_ENDPOINT,
      _query,
      body,
      headers
    );
  }

  static async confirmOrders(query, body) {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': SHOPPABLE_APIKEY,
    };

    const _query = {
      op: 'ConfirmOrders',
      ...query,
    };

    return _authHttpRequest.send(
      'POST',
      SHOPPABLE_ENDPOINT,
      _query,
      body,
      headers
    );
  }

  static async getWorkflowStatus(executionArn) {
    const query = { executionArn };
    return _authHttpRequest.send(
      'GET',
      ENDPOINTS.Workflow,
      query
    );
  }
}
