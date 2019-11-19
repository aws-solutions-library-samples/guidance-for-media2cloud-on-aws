/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-plusplus */
/* eslint-disable no-alert */

/**
 * @class ApiHelper
 */
class ApiHelper {
  static get Endpoints() {
    const x0 = SO0050.ApiEndpoint;
    const x1 = window.AWSomeNamespace.ApiOps;

    return {
      Asset: `${x0}/${x1.Assets}`,
      Analysis: `${x0}/${x1.Analysis}`,
      Labeling: `${x0}/${x1.Labeling}`,
      Search: `${x0}/${x1.Search}`,
      Face: {
        ResetCollection: `${x0}/${x1.FaceColection}`,
        Index: `${x0}/${x1.IndexFace}`,
        Queue: `${x0}/${x1.QueueFace}`,
      },
      Workteam: `${x0}/${x1.Workteam}`,
      Execution: `${x0}/${x1.Execution}`,
      AttachIot: `${x0}/${x1.AttachPolicy}`,
      EditLabel: `${x0}/${x1.EditLabel}`,
    };
  }

  /* record related methods */
  static async scanRecords(query) {
    return AppUtils.authHttpRequest('GET', ApiHelper.Endpoints.Asset, query);
  }

  static async getRecord(uuid) {
    return AppUtils.authHttpRequest('GET', `${ApiHelper.Endpoints.Asset}/${uuid}`);
  }

  static async purgeRecord(uuid) {
    return AppUtils.authHttpRequest('DELETE', `${ApiHelper.Endpoints.Asset}/${uuid}`);
  }

  /* aiml results */
  static async getAnalysisResults(uuid) {
    return AppUtils.authHttpRequest('GET', `${ApiHelper.Endpoints.Analysis}/${uuid}`);
  }

  /* face collection */
  static async resetFaceCollection(id) {
    return AppUtils.authHttpRequest('DELETE', `${ApiHelper.Endpoints.Face.ResetCollection}/${id}`);
  }

  static async indexFace(body, query) {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.Face.Index, query, body);
  }

  static async getIndexFaces(uuid) {
    return AppUtils.authHttpRequest('GET', `${ApiHelper.Endpoints.Face.Index}/${uuid}`);
  }

  static async queueFace(body, query) {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.Face.Queue, query, body);
  }

  static async getQueueFaces(uuid) {
    return AppUtils.authHttpRequest('GET', `${ApiHelper.Endpoints.Face.Queue}/${uuid}`);
  }

  /* iot */
  static async attachIot() {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.AttachIot);
  }

  /* search method */
  static async search(query) {
    return AppUtils.authHttpRequest('GET', ApiHelper.Endpoints.Search, query);
  }

  /* workflow related methods */
  static async startIngestWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.Asset, query, body);
  }

  static async startAnalysisWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.Analysis, query, body);
  }

  static async startLabelingWorkflow(body, query) {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.Labeling, query, body);
  }

  /* label editing methods */
  static async editLabel(body, query) {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.EditLabel, query, body);
  }
}
