/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import SolutionManifest from '/solution-manifest.js';
import AppUtils from './appUtils.js';

const ENDPOINTS = {
  Asset: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Assets}`,
  Analysis: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Analysis}`,
  Labeling: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Labeling}`,
  Workteam: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Workteam}`,
  Search: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Search}`,
  Execution: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.Execution}`,
  AttachIot: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.AttachPolicy}`,
  EditLabel: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.EditLabel}`,
  Face: {
    ResetCollection: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.FaceCollection}`,
    Index: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.IndexFace}`,
    Queue: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.QueueFace}`,
  },
  FaceCollections: `${SolutionManifest.ApiEndpoint}/${SolutionManifest.ApiOps.FaceCollections}`,
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

  /* face collection */
  static async resetFaceCollection(id) {
    return AppUtils.authHttpRequest('DELETE', `${ENDPOINTS.Face.ResetCollection}/${id}`);
  }

  static async indexFace(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Face.Index, query, body);
  }

  static async getIndexFaces(uuid) {
    return AppUtils.authHttpRequest('GET', `${ENDPOINTS.Face.Index}/${uuid}`);
  }

  static async queueFace(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Face.Queue, query, body);
  }

  static async getQueueFaces(uuid) {
    return AppUtils.authHttpRequest('GET', `${ENDPOINTS.Face.Queue}/${uuid}`);
  }

  /* iot */
  static async attachIot() {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.AttachIot);
  }

  /* search method */
  static async search(query) {
    return AppUtils.authHttpRequest('GET', ENDPOINTS.Search, query);
  }

  /* workflow related methods */
  static async startIngestWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Asset, query, body);
  }

  static async startAnalysisWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Analysis, query, body);
  }

  static async startLabelingWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Labeling, query, body);
  }

  static async startWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.Asset, query, body);
  }

  /* label editing methods */
  static async editLabel(body, query) {
    return AppUtils.authHttpRequest('POST', ENDPOINTS.EditLabel, query, body);
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
}
