// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  StateData,
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      Face,
      FaceMatch,
      Label,
      Moderation,
      Text,
    },
  },
  AnalysisError,
  CommonUtils,
  Indexer,
  FaceIndexer,
} = require('core-lib');

const INDEX_CONTENT = Indexer.getContentIndex();
const ANALYSIS_TYPE = 'image';
const CATEGORY = 'rekog-image';
const CAPTION = 'caption';

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

    let fields = await Promise.all(subCategories
      .map((subCategory) =>
        this.parseResults(
          subCategory,
          bucket,
          data[subCategory].output
        )));
    fields = fields.reduce((a0, c0) => ({
      ...a0,
      ...c0,
    }), {});

    if (Object.keys(fields).length > 0) {
      await this.indexResults(fields);
    }

    return this.setCompleted();
  }

  async parseResults(subCategory, bucket, key) {
    if (!bucket || !key) {
      return undefined;
    }

    const data = await CommonUtils.download(bucket, key)
      .then((res) =>
        JSON.parse(res))
      .catch((e) => {
        console.error(
          'ERR:',
          'StateIndexAnalysisResults.parseResults:',
          'CommonUtils.download:',
          e.name,
          e.message,
          subCategory
        );
        return undefined;
      });

    let datasets;
    if (subCategory === Celeb) {
      datasets = this.parseCeleb(data);
    } else if (subCategory === Face) {
      datasets = this.parseFace(data);
    } else if (subCategory === FaceMatch) {
      datasets = this.parseFaceMatch(data);
    } else if (subCategory === Label) {
      datasets = this.parseLabel(data);
    } else if (subCategory === Moderation) {
      datasets = this.parseModeration(data);
    } else if (subCategory === Text) {
      datasets = this.parseText(data);
    } else if (subCategory === CAPTION) {
      datasets = this.parseCaption(data);
    }

    if (datasets && datasets.length > 0) {
      return {
        [subCategory]: datasets,
      };
    }

    return undefined;
  }

  async indexResults(fields) {
    const uuid = this.stateData.uuid;

    const indexer = new Indexer();
    return indexer.update(
      INDEX_CONTENT,
      uuid,
      fields
    );
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
    const face = (((data || {})
      .FaceMatches || [])[0] || {}).Face;

    if (face === undefined) {
      return undefined;
    }

    const faceId = face.FaceId;

    let name = face.Name;
    if (!name) {
      name = FaceIndexer.resolveExternalImageId(
        face.ExternalImageId,
        faceId
      );
    }

    return [{
      name,
      faceId,
    }];
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

    const uniques = [
      ...new Set(texts),
    ].map((name) => ({
      name,
    }));

    return uniques;
  }

  parseCaption(data = {}) {
    let uniques = [];

    const {
      description,
      location,
      tags,
    } = data;
    if ((description || {}).text) {
      uniques.push(description.text);
    }

    if ((location || {}).text) {
      uniques.push(location.text);
    }

    (tags || []).forEach((tag) => {
      if ((tag || {}).text) {
        uniques.push(tag.text);
      }
    });

    uniques = [
      ...new Set(uniques),
    ];
    uniques = uniques
      .map((text) => ({
        name: text,
      }));

    return uniques;
  }

  setCompleted() {
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }
}

module.exports = StateIndexAnalysisResults;
