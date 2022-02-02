// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisTypes,
  AnalysisError,
  CommonUtils,
  Indexer,
} = require('core-lib');

const ANALYSIS_TYPE = 'image';
const CATEGORY = 'rekog-image';

class StateIndexAnalysisResults {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateIndexAnalysisResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const bucket = this.stateData.input.destination.bucket;
    const data = this.stateData.data[ANALYSIS_TYPE][CATEGORY];
    const subCategories = Object.keys(data);
    await Promise.all(subCategories.map((subCategory) =>
      this.indexResults(subCategory, bucket, data[subCategory].output)));
    return this.setCompleted();
  }

  async indexResults(subCategory, bucket, key) {
    if (!bucket || !key) {
      return undefined;
    }
    const data = await CommonUtils.download(bucket, key, false)
      .then((res) =>
        JSON.parse(res.Body))
      .catch((e) =>
        console.error(`[ERR]: CommonUtils.download: ${subCategory}: ${bucket}/${key}: ${e.code} ${e.message}`));
    const datasets = (subCategory === AnalysisTypes.Rekognition.Celeb)
      ? this.parseCeleb(data)
      : (subCategory === AnalysisTypes.Rekognition.Face)
        ? this.parseFace(data)
        : (subCategory === AnalysisTypes.Rekognition.FaceMatch)
          ? this.parseFaceMatch(data)
          : (subCategory === AnalysisTypes.Rekognition.Label)
            ? this.parseLabel(data)
            : (subCategory === AnalysisTypes.Rekognition.Moderation)
              ? this.parseModeration(data)
              : (subCategory === AnalysisTypes.Rekognition.Text)
                ? this.parseText(data)
                : undefined;
    if (datasets && datasets.length > 0) {
      const uuid = this.stateData.uuid;
      const indexer = new Indexer();
      return indexer.indexDocument(subCategory, uuid, {
        type: ANALYSIS_TYPE,
        data: datasets,
      }).catch((e) =>
        console.error(`[ERR]: indexer.indexDocument: ${uuid}: ${subCategory}`, e));
    }
    return undefined;
  }

  parseCeleb(data) {
    const celebs = ((data || {}).CelebrityFaces || [])
      .map((x) =>
        x.Name);
    return [...new Set(celebs)].map((name) => ({
      name,
    }));
  }

  parseFace(data) {
    const genders = ((data || {}).FaceDetails || [])
      .filter((x) =>
        x.Gender !== undefined)
      .map((x) =>
        x.Gender.Value);
    return [...new Set(genders)].map((name) => ({
      name,
    }));
  }

  parseFaceMatch(data) {
    const externalImageId = ((((data || {})
      .FaceMatches || [])[0] || {}).Face || {}).ExternalImageId;
    return (!externalImageId)
      ? undefined
      : [
        {
          name: externalImageId.replace(/_/g, ' '),
        },
      ];
  }

  parseLabel(data) {
    const labels = ((data || {}).Labels || [])
      .map((x) =>
        x.Name);
    return [...new Set(labels)].map((name) => ({
      name,
    }));
  }

  parseModeration(data) {
    const moderations = ((data || {}).ModerationLabels || [])
      .map((x) => ([
        x.Name,
        x.ParentName,
      ]))
      .flat()
      .filter((x) => x);
    return [...new Set(moderations)].map((name) => ({
      name,
    }));
  }

  parseText(data) {
    const texts = ((data || {}).TextDetections || [])
      .map((x) =>
        x.DetectedText.trim());
    return [...new Set(texts)].map((name) => ({
      name,
    }));
  }

  setCompleted() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateIndexAnalysisResults;
