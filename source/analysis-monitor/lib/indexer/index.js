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
/* eslint-disable global-require */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const PATH = require('path');

const {
  StateData,
  BaseIndex,
  CommonUtils,
  Environment,
  Metrics,
} = require('m2c-core-lib');

/**
 * @class Indexer
 */
class Indexer extends BaseIndex {
  constructor(stateData) {
    super();
    this.$stateData = stateData;
  }

  get stateData() {
    return this.$stateData;
  }

  /**
   * @async
   * @override
   * @function indexResults
   * @description index aiml analysis results to elasticsearch engine
   */
  async indexResults(...args) {
    const responses = await Promise.all([
      this.buildVideoKeywords(),
      this.buildAudioKeywords(),
      this.buildImageKeywords(),
    ]);

    const result = responses.filter(x => x).reduce((acc, cur) =>
      Object.assign(acc, cur), {});

    if (Object.keys(result || {}).length) {
      await this.indexDocument(this.stateData.uuid, result);
      await this.sendAnonymous(result);
      this.stateData.setData('indexer', {
        terms: Object.keys(result),
      });
    }
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async buildVideoKeywords() {
    const video = (this.stateData.input || {}).video;
    if (!video || video.status === StateData.Statuses.NotStarted) {
      return undefined;
    }

    const responses = await Promise.all(Object.keys(video.rekognition || {}).map(x =>
      this.parseRekogOutput(x, video.rekognition[x].output)));

    return responses.filter(x => x).reduce((acc, cur) =>
      Object.assign(acc, cur), {});
  }

  async buildAudioKeywords() {
    const audio = (this.stateData.input || {}).audio;
    if (!audio || audio.status === StateData.Statuses.NotStarted) {
      return undefined;
    }

    const responses = await Promise.all(Object.keys(audio.comprehend || {}).map(x =>
      this.parseComprehendOutput(x, audio.comprehend[x].output)));

    return responses.filter(x => x).reduce((acc, cur) =>
      Object.assign(acc, cur), {});
  }

  async buildImageKeywords() {
    const image = (this.stateData.input || {}).image;
    if (!image || image.status === StateData.Statuses.NotStarted) {
      return undefined;
    }

    const responses = await Promise.all(Object.keys(image['rekog-image'] || {}).map(x =>
      this.parseRekogImageOutput(x, image['rekog-image'][x].output)));

    return responses.filter(x => x).reduce((acc, cur) =>
      Object.assign(acc, cur), {});
  }

  async parseRekogOutput(type, key) {
    if (!key) {
      return undefined;
    }

    if (type === 'person' || type === 'face') {
      return undefined;
    }

    let result =
      await CommonUtils.download(Environment.Proxy.Bucket, key).catch(() => undefined);

    if (!result) {
      return undefined;
    }
    result = JSON.parse(result);

    const keys = Array.from(new Set(Object.keys(result).map(x =>
      x.toLowerCase())));

    return (!keys.length) ? undefined : {
      [type]: keys,
    };
  }

  async parseComprehendOutput(type, key) {
    if (!key) {
      return undefined;
    }

    let name;
    let sub;
    switch (type) {
      case 'entity':
        name = 'Entities';
        sub = 'Text';
        break;
      case 'keyphrase':
        name = 'KeyPhrases';
        sub = 'Text';
        break;
      case 'sentiment':
        name = 'Sentiments';
        sub = 'Sentiment';
        break;
      case 'topic':
      default:
        return undefined;
    }

    let result =
      await CommonUtils.download(Environment.Proxy.Bucket, key).catch(() => undefined);

    if (!result) {
      return undefined;
    }

    result = JSON.parse(result);

    const keys = Array.from(new Set(result[name].map(x =>
      x[sub].toLowerCase())));

    return (!keys.length) ? undefined : {
      [type]: keys,
    };
  }

  async parseRekogImageOutput(type, key) {
    if (!key) {
      return undefined;
    }

    let name;
    let sub;
    let sub02;
    switch (type) {
      case 'celeb':
        name = 'CelebrityFaces';
        sub = 'Name';
        break;
      case 'faceMatch':
        name = 'FaceMatches';
        sub = 'Face';
        sub02 = 'ExternalImageId';
        break;
      case 'label':
        name = 'Labels';
        sub = 'Name';
        break;
      case 'moderation':
        name = 'ModerationLabels';
        sub = 'Name';
        break;
      case 'text':
        name = 'TextDetections';
        sub = 'DetectedText';
        break;
      case 'face':
      default:
        return undefined;
    }

    let result =
      await CommonUtils.download(Environment.Proxy.Bucket, key).catch(() => undefined);

    if (!result) {
      return undefined;
    }

    result = JSON.parse(result);

    if (type === 'text') {
      result.TextDetections = result.TextDetections.filter(x =>
        x.Type === 'WORD');
    }

    let keys = (!sub02)
      ? result[name].map(x => x[sub].toLowerCase())
      : result[name].map(x => x[sub][sub02].replace(/_/g, ' ').toLowerCase());
    keys = Array.from(new Set(keys));

    return (!keys.length) ? undefined : {
      [type]: keys,
    };
  }

  /**
   * @async
   * @function sendAnonymous
   * @description send anonymous data to help us to improve the solution
   * @param {Object} data - analysis data
   */
  async sendAnonymous(data) {
    if (!Environment.Solution.Metrics.AnonymousUsage) {
      return;
    }

    const metrics = this.stateData.input.metrics || {};
    const aiml = Object.assign({}, this.stateData.input.aiOptions);
    delete aiml.customVocabulary;
    delete aiml.faceCollectionId;

    await Metrics.sendAnonymousData({
      uuid: this.stateData.uuid,
      process: 'analysis',
      elapsed: metrics.endTime - metrics.startTime,
      aiml,
    }).catch(e => console.log(`sendAnonymous: ${e.message}`));
  }
}

module.exports = {
  Indexer,
};
