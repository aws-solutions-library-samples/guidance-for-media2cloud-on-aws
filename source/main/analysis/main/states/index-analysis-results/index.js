/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const PATH = require('path');
const {
  StateData,
  CommonUtils,
  BaseIndex,
  AnalysisTypes,
  AnalysisError,
} = require('core-lib');

const CATEGORY_DOCUMENT = 'document';
const SUBCATEGORY_TEXTRACT = 'textract';

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
    const responses = await Promise.all([
      this.buildVideoKeywords(),
      this.buildAudioKeywords(),
      this.buildImageKeywords(),
      this.buildDocumentKeywords(),
    ]);

    const result = responses.filter(x => x)
      .reduce((acc, cur) => ({
        ...acc,
        ...cur,
      }), {});

    if (Object.keys(result || {}).length) {
      await this.indexDocument(this.stateData.uuid, result);
    }
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async buildVideoKeywords() {
    const video = (this.stateData.data || {}).video;
    if (!video || video.status !== StateData.Statuses.Completed) {
      return undefined;
    }
    const bucket = this.stateData.input.destination.bucket;
    const detections = Object.keys(video.rekognition || {});
    const responses = await Promise.all(detections.map(x =>
      this.parseRekogOutput(x, bucket, video.rekognition[x].output)));

    return responses.filter(x => x)
      .reduce((acc, cur) => ({
        ...acc,
        ...cur,
      }), {});
  }

  async parseRekogOutput(type, bucket, key) {
    if (!bucket || !key) {
      return undefined;
    }
    if (type === 'person' || type === 'face' || type === 'segment') {
      return undefined;
    }
    let result = await CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data))
      .catch(() => undefined);
    if (!result) {
      return undefined;
    }
    result = Object.keys(result).map(x => x.toLowerCase().replace(/_/g, ' '));
    result = [...new Set(result)];
    return (result.length)
      ? {
        [type]: result,
      }
      : undefined;
  }

  async buildAudioKeywords() {
    const audio = (this.stateData.data || {}).audio;
    if (!audio || audio.status !== StateData.Statuses.Completed) {
      return undefined;
    }
    const bucket = this.stateData.input.destination.bucket;
    const detections = Object.keys(audio.comprehend || {});
    let responses = await Promise.all(detections.map(x =>
      this.parseComprehendOutput(x, bucket, audio.comprehend[x].output)));
    responses = responses.filter(x => x);
    /* If Amazon Comprehend doesn't support the language, */
    /* index phrases extracrted from Amazon Transcribe */
    if (!responses.length) {
      responses.push(await this.parseTranscribeOutput('transcribe', bucket, audio.transcribe.phrases));
    }
    return responses.filter(x => x)
      .reduce((acc, cur) => ({
        ...acc,
        ...cur,
      }), {});
  }

  async parseComprehendOutput(type, bucket, key) {
    if (!bucket || !key) {
      return undefined;
    }

    let sub;
    switch (type) {
      case 'entity':
        sub = 'Text';
        break;
      case 'keyphrase':
        sub = 'Text';
        break;
      case 'sentiment':
        sub = 'Sentiment';
        break;
      case 'topic':
      default:
        return undefined;
    }

    let result = await CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data))
      .catch(() => undefined);

    if (!result) {
      return undefined;
    }

    result = CommonUtils.flatten(result, 10);
    result = result.map(x => x[sub].toLowerCase());
    result = [...new Set(result)];
    return (result.length)
      ? {
        [type]: result,
      }
      : undefined;
  }

  async parseTranscribeOutput(type, bucket, key) {
    if (!bucket || !key) {
      return undefined;
    }

    let result = await CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data))
      .catch(() => undefined);
    if (!result) {
      return undefined;
    }

    result = result.map(x => x.content.trim());
    return (result.length)
      ? {
        [type]: result,
      }
      : undefined;
  }

  async buildImageKeywords() {
    const image = (this.stateData.data || {}).image;
    if (!image || image.status !== StateData.Statuses.Completed) {
      return undefined;
    }
    const bucket = this.stateData.input.destination.bucket;
    const detections = Object.keys(image['rekog-image'] || {});
    const responses = await Promise.all(detections.map(x =>
      this.parseRekogImageOutput(x, bucket, image['rekog-image'][x].output)));
    return responses.filter(x => x)
      .reduce((acc, cur) => ({
        ...acc,
        ...cur,
      }), {});
  }

  async parseRekogImageOutput(type, bucket, key) {
    if (!bucket || !key) {
      return undefined;
    }

    let name;
    let sub;
    let sub02;
    switch (type) {
      case AnalysisTypes.Rekognition.Celeb:
        name = 'CelebrityFaces';
        sub = 'Name';
        break;
      case AnalysisTypes.Rekognition.FaceMatch:
        name = 'FaceMatches';
        sub = 'Face';
        sub02 = 'ExternalImageId';
        break;
      case AnalysisTypes.Rekognition.Label:
        name = 'Labels';
        sub = 'Name';
        break;
      case AnalysisTypes.Rekognition.Moderation:
        name = 'ModerationLabels';
        sub = 'Name';
        break;
      case AnalysisTypes.Rekognition.Text:
        name = 'TextDetections';
        sub = 'DetectedText';
        break;
      case AnalysisTypes.Rekognition.Face:
      default:
        return undefined;
    }

    let result = await CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data))
      .catch(() => undefined);

    if (!result) {
      return undefined;
    }

    if (type === 'text') {
      result.TextDetections = result.TextDetections.filter(x =>
        x.Type === 'WORD');
    }

    if (!sub02) {
      result = result[name].map(x =>
        x[sub].toLowerCase());
    } else {
      result = result[name]
        .map(x =>
          x[sub][sub02].replace(/_/g, ' ').toLowerCase());
    }
    result = [...new Set(result)];
    return (result.length)
      ? {
        [type]: result,
      }
      : undefined;
  }

  async buildDocumentKeywords() {
    const document = (this.stateData.data || {})[CATEGORY_DOCUMENT];
    if (!document || document.status !== StateData.Statuses.Completed) {
      return undefined;
    }
    const data = document[SUBCATEGORY_TEXTRACT] || {};
    if (!data.output || !data.textlist) {
      return undefined;
    }
    const bucket = this.stateData.input.destination.bucket;
    const key = PATH.join(data.output, data.textlist);
    return this.parseTextractOutput(SUBCATEGORY_TEXTRACT, bucket, key);
  }

  async parseTextractOutput(type, bucket, key) {
    const data = await CommonUtils.download(bucket, key, false)
      .then(x => JSON.parse(x.Body.toString()))
      .catch(() => undefined);
    return (data && data.length > 0)
      ? {
        [type]: data,
      }
      : undefined;
  }

  async indexDocument(uuid, data) {
    const indexer = new BaseIndex();
    return indexer.indexDocument(uuid, data);
  }
}

module.exports = StateIndexAnalysisResults;
