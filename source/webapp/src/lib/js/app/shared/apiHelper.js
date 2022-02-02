// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import AppUtils from './appUtils.js';

const ENDPOINTS = {
  Asset: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Assets}`,
  Analysis: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Analysis}`,
  Search: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Search}`,
  Execution: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Execution}`,
  AttachIot: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.AttachPolicy}`,
  FaceCollections: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.FaceCollections}`,
  FaceCollection: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.FaceCollection}`,
  Faces: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Faces}`,
  Face: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Face}`,
  CustomLabelModels: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.CustomLabelModels}`,
  CustomVocabularies: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.CustomVocabularies}`,
  CustomLanguageModels: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.CustomLanguageModels}`,
  CustomEntityRecognizers: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.CustomEntityRecognizers}`,
  Stats: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Stats}`,
};

export default class ApiHelper {
  /* record related methods */
  static async scanRecords(query) {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.Asset, query);
  }

  static async getRecord(uuid) {
    return AppUtils.authHttpRequest('GET', `${ENDPOINTS.Asset}/${uuid}`);
  }

  static async purgeRecord(uuid) {
    return AppUtils.authHttpRequest('DELETE', `${ENDPOINTS.Asset}/${uuid}`);
  }

  /* aiml results */
  static async getAnalysisResults(uuid) {
    return AppUtils.authHttpRequest('GET', `${ENDPOINTS.Analysis}/${uuid}`);
  }

  /* iot */
  static async attachIot() {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.AttachIot);
  }

  /* search method */
  static async search(query) {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.Search, query);
  }

  static async searchInDocument(docId, query) {
    return AppUtils.authHttpRequest('GET', `${ENDPOINTS.Search}/${docId}`, query);
  }

  /* workflow related methods */
  static async startIngestWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Asset, query, body);
  }

  static async startAnalysisWorkflow(uuid, body, query) {
    return AppUtils.authHttpRequest('POST', `${ENDPOINTS.Analysis}/${uuid}`, query, body);
  }

  static async startWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Asset, query, body);
  }

  static async getRekognitionFaceCollections() {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.FaceCollections);
  }

  static async getRekognitionCustomLabelModels() {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.CustomLabelModels);
  }

  static async getTranscribeCustomVocabulary() {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.CustomVocabularies);
  }

  static async getTranscribeCustomLanguageModels() {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.CustomLanguageModels);
  }

  static async getComprehendCustomEntityRecognizers() {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.CustomEntityRecognizers);
  }

  /* stats */
  static async getStats(query) {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.Stats, query);
  }

  /* face collection */
  static async getFaceCollections() {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.FaceCollections);
  }

  static async createFaceCollection(collectionId) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.FaceCollection, undefined, {
      collectionId,
    });
  }

  static async deleteFaceCollection(collectionId) {
    return AppUtils.authHttpRequest('DELETE', ENDPOINTS.FaceCollection, {
      collectionId,
    });
  }

  static async getFacesInCollection(collectionId, options) {
    const token = (options.token)
      ? encodeURIComponent(options.token)
      : undefined;
    return AppUtils.authHttpRequest('GET', ENDPOINTS.Faces, {
      ...options,
      token,
      collectionId,
    });
  }

  static async deleteFaceFromCollection(collectionId, faceId) {
    return AppUtils.authHttpRequest('DELETE', ENDPOINTS.Face, {
      collectionId,
      faceId,
    });
  }

  static async indexFaceToCollection(collectionId, options) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Face, undefined, {
      ...options,
      collectionId,
    });
  }
}
