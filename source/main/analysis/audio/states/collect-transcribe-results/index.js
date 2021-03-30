/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const AWS = require('aws-sdk');
const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
  WebVttTrack,
} = require('core-lib');
const {
  CueItem,
  CueLineQ,
} = require('../shared/cueLine');

const CATEGORY = 'transcribe';
const CUELINE_OUTPUT = 'cuelines.json';
const SUBTITLE_OUTPUT = 'subtitle.vtt';
const PHRASES_OUTPUT = 'phrases.json';

class StateTranscribeResults {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  get [Symbol.toStringTag]() {
    return 'StateTranscribeResults';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const jobId = this.stateData.data[CATEGORY].jobId;
    /* get job result */
    const jobResult = await this.getJob(jobId);
    if (jobResult.TranscriptionJob.TranscriptionJobStatus !== 'COMPLETED') {
      let message = jobResult.TranscriptionJob.FailureReason
        || jobResult.TranscriptionJob.TranscriptionJobStatus;
      message = `${jobId}: ${message};`;
      throw new AnalysisError(message);
    }

    /* download transcription */
    const bucket = this.stateData.input.destination.bucket;
    const key = this.stateData.data[CATEGORY].output;
    const transcript = await CommonUtils.download(bucket, key)
      .then(data => JSON.parse(data));

    /* create cue lines */
    let prefix;
    const [
      cuelines,
      totalWordCounts,
    ] = this.createCueLines(transcript.results.items);

    let cuelinesOutput;
    let subtitleOutput;
    let phrasesOutput;
    if (cuelines.length) {
      prefix = this.makeMetadataPrefix();
      cuelinesOutput = PATH.join(prefix, CUELINE_OUTPUT);
      await CommonUtils.uploadFile(bucket, prefix, CUELINE_OUTPUT, cuelines);
    }

    /* flatten the cuelines items */
    let timelines = [].concat(...cuelines.map(x => x.cueItems));
    timelines = this.createTimelines(timelines);
    if (timelines.length) {
      /* create webvtt */
      prefix = this.makeVttPrefix();
      const subtitle = this.createWebVtt(timelines);
      subtitleOutput = PATH.join(prefix, SUBTITLE_OUTPUT);
      await CommonUtils.uploadFile(bucket, prefix, SUBTITLE_OUTPUT, subtitle);

      /* create phrases */
      prefix = this.makeMetadataPrefix();
      const phrases = this.createPhrases(timelines);
      phrasesOutput = PATH.join(prefix, PHRASES_OUTPUT);
      await CommonUtils.uploadFile(bucket, prefix, PHRASES_OUTPUT, phrases);
    }

    this.stateData.setData(CATEGORY, {
      languageCode: jobResult.TranscriptionJob.LanguageCode,
      cuelines: cuelinesOutput,
      vtt: subtitleOutput,
      phrases: phrasesOutput,
      totalWordCounts,
      endTime: new Date().getTime(),
    });
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  async getJob(jobId) {
    const transcribe = new AWS.TranscribeService({
      apiVersion: '2017-10-26',
    });
    return transcribe.getTranscriptionJob({
      TranscriptionJobName: jobId,
    }).promise();
  }

  createCueLines(data) {
    let totalWordCounts = 0;
    const cuelines = [];
    const queue = new CueLineQ();
    while (data.length) {
      const item = CueItem.createFromTranscript(data.shift());
      if (!item.canUse()) {
        continue;
      }
      if (!queue.length) {
        queue.push(item);
        continue;
      }
      /* slice the cuelines (less than 5,000 characters) making it easier */
      /* for the downstream Amazon Comprehend processes. */
      if (queue.byteLengthExceedThreshold(item)
      && !CueItem.testPunctuation(data[0])) {
        queue.embedCharacterOffsets();
        cuelines.push(queue.toJSON());
        totalWordCounts += queue.wordCounts;
        queue.empty();
      }
      queue.push(item);
    }
    if (queue.length) {
      queue.embedCharacterOffsets();
      cuelines.push(queue.toJSON());
      totalWordCounts += queue.wordCounts;
      queue.empty();
    }

    return [
      cuelines,
      totalWordCounts,
    ];
  }

  makeVttPrefix() {
    return PATH.join(
      this.stateData.input.destination.prefix,
      'vtt',
      CATEGORY,
      '/'
    );
  }

  makeMetadataPrefix() {
    return PATH.join(
      this.stateData.input.destination.prefix,
      'metadata',
      CATEGORY,
      '/'
    );
  }

  createTimelines(items) {
    const collection = [];

    const queue = new CueLineQ();
    while (items.length) {
      const item = new CueItem(items.shift());
      if (!item.canUse()) {
        continue;
      }
      if (!queue.length) {
        queue.push(item);
        continue;
      }
      if ((queue.lineCharacterExceedThreshold(item)
      || queue.lineDurationExceedThreshold(item)
      || queue.longPauseExceedThreshold(item))
      && !item.isPunctuation()) {
        collection.push(queue.reduceAll());
      }
      queue.push(item);
    }
    if (queue.length) {
      collection.push(queue.reduceAll());
    }
    return collection;
  }

  createWebVtt(collection) {
    const track = new WebVttTrack();
    collection.forEach(x =>
      track.addCue(x.begin, x.end, x.cueText));
    return track.toString();
  }

  createPhrases(cues) {
    return cues.map(x => x.toJSON());
  }
}

module.exports = StateTranscribeResults;
