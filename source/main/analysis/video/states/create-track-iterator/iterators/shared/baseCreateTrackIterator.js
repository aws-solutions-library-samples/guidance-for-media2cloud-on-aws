// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils,
  TimelineQ,
  WebVttTrack,
} = require('core-lib');

const CATEGORY = 'rekognition';
const MAP_FILENAME = 'mapFile.json';
const TIMESERIES = 'timeseries';
const METADATA = 'metadata';
const VTT = 'vtt';
const EDL = 'edl';

class BaseCreateTrackIterator {
  constructor(stateData, subCategory) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    /* detection type such as label, celeb, and etc */
    if (!subCategory) {
      throw new AnalysisError('subCategory not specified');
    }
    this.$stateData = stateData;
    this.$subCategory = subCategory;
    this.$mapData = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'BaseCreateTrackIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  get subCategory() {
    return this.$subCategory;
  }

  get mapData() {
    return this.$mapData;
  }

  set mapData(val) {
    this.$mapData = val;
  }

  get enableVtt() {
    return true;
  }

  get enableMetadata() {
    return true;
  }

  get enableTimeseries() {
    return true;
  }

  get enableEdl() {
    return false;
  }

  /* derived class to implement */
  async downloadSelected(bucket, key, name) {
    throw new AnalysisError('subclass to implement');
  }

  /* derived class to implement */
  createTimeseriesData(name, data) {
    return undefined;
  }

  async process() {
    const data = this.stateData.data[this.subCategory];
    this.mapData = await this.getMapData();
    if (!this.mapData) {
      this.setCompleted();
      return this.stateData.toJSON();
    }
    const uniqueNames = Object.keys(this.mapData).splice(data.cursor);
    while (uniqueNames.length) {
      const t0 = new Date();
      const name = uniqueNames.shift();
      await this.processTrack(name);
      data.cursor++;
      /* make sure we allocate enough time for the next iteration */
      const remained = this.stateData.getRemainingTime();
      const consumed = new Date() - t0;
      console.log(`COMPLETED: name: '${name}' [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);
      if (this.stateData.quitNow() || (remained - (consumed * 1.2) <= 0)) {
        break;
      }
    }
    if (uniqueNames.length > 0) {
      const total = data.cursor + uniqueNames.length;
      return this.setProgress(Math.round((data.cursor / total) * 100));
    }
    return this.setCompleted();
  }

  async getMapData() {
    const data = this.stateData.data[this.subCategory];
    const prefix = this.makeRawDataPrefix(this.subCategory);
    const name = MAP_FILENAME;
    /* download and merge mapData */
    return CommonUtils.download(data.bucket, PATH.join(prefix, name), false)
      .then(x => JSON.parse(x.Body.toString()))
      .catch(() => undefined);
  }

  async processTrack(name) {
    const promises = [];
    const data = this.stateData.data[this.subCategory];
    const prefix = this.makeRawDataPrefix(this.subCategory);
    /* #1: download selected content */
    let appearances = await Promise.all(this.mapData[name].map(x =>
      this.downloadSelected(data.bucket, PATH.join(prefix, x), name)));
    appearances = appearances.reduce((a0, c0) => a0.concat(c0), []);
    /* #1.1: create timelines */
    const timelines = this.createTimelines(name, appearances);
    /* #2: create and upload timeseries data */
    let oPrefix;
    let oName;
    const basename = name.toLowerCase().replace(/\s/g, '_').replace(/\//g, '-');
    if (this.enableTimeseries) {
      const timeseries = this.createTimeseriesData(name, appearances);
      if (timeseries) {
        /* compute show rate, duration and appearance */
        timeseries.duration = data.duration || 1;
        const appearance = (!timelines)
          ? 0
          : timelines.reduce((a0, c0) =>
            a0 + (c0.end - c0.begin), 0);
        timeseries.appearance = Math.round(appearance);
        oPrefix = this.makeTimeseriesPrefix();
        oName = `${basename}.json`;
        promises.push(CommonUtils.uploadFile(data.bucket, oPrefix, oName, timeseries));
      }
    }
    /* #3: create metadata and vtt data */
    if (!this.enableMetadata && !this.enableVtt) {
      return Promise.all(promises);
    }
    if (!timelines) {
      return Promise.all(promises);
    }
    if (this.enableMetadata) {
      oName = `${basename}.json`;
      oPrefix = this.makeMetadataPrefix();
      const metadata = JSON.stringify(timelines.map(x => x.toJSON()));
      promises.push(CommonUtils.uploadFile(data.bucket, oPrefix, oName, metadata));
    }
    if (this.enableVtt) {
      oName = `${basename}.vtt`;
      oPrefix = this.makeVttPrefix();
      const vtt = this.createWebVtt(name, timelines);
      promises.push(CommonUtils.uploadFile(data.bucket, oPrefix, oName, vtt.toString()));
    }
    return Promise.all(promises);
  }

  createTimelines(name, dataset) {
    const data = this.stateData.data[this.subCategory];
    const options = (data.sampling)
      ? {
        timeDriftExceedThreshold: Math.round(data.sampling * 1.2),
      }
      : undefined;
    const timelines = [];
    const queue = new TimelineQ();
    for (let data of dataset) {
      const item = TimelineQ.createTypedItem(data, options);
      if (!item.canUse()) {
        continue;
      }
      if (!queue.length) {
        queue.push(item);
        continue;
      }
      if (TimelineQ.timeDriftExceedThreshold(queue.last, item)
      || TimelineQ.positionDriftExceedThreshold(queue.last, item)) {
        timelines.unshift(queue.reduceAll());
      }
      queue.push(item);
    }
    if (queue.length) {
      timelines.push(queue.reduceAll());
    }
    return timelines;
  }

  createWebVtt(name, timelines) {
    const track = new WebVttTrack();
    timelines.map(x =>
      track.addCue(x.begin, x.end, x.cueText, x.cueAlignment));
    return track;
  }

  setCompleted(params) {
    const data = this.stateData.data[this.subCategory];
    const metadata = (this.enableMetadata)
      ? this.makeMetadataPrefix()
      : undefined;
    const vtt = (this.enableVtt)
      ? this.makeVttPrefix()
      : undefined;
    const timeseries = (this.enableTimeseries)
      ? this.makeTimeseriesPrefix()
      : undefined;
    const edl = (this.enableEdl)
      ? this.makeEdlPrefix()
      : undefined;
    const output = (this.mapData)
      ? PATH.join(this.makeRawDataPrefix(this.subCategory), MAP_FILENAME)
      : this.makeRawDataPrefix(this.subCategory);
    const responseData = {
      startTime: data.startTime,
      endTime: data.endTime || Date.now(),
      backlogId: data.backlogId,
      jobId: data.jobId,
      numOutputs: data.numOutputs,
      bucket: data.bucket,
      output,
      metadata,
      timeseries,
      vtt,
      edl,
      ...params,
    };
    this.stateData.data[this.subCategory] = responseData;
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  setProgress(pencentage) {
    this.stateData.setProgress(pencentage);
    return this.stateData.toJSON();
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory || this.subCategory];
    const timestamp = CommonUtils.toISODateTime(data.requestTime);
    return PATH.join(
      data.prefix,
      'raw',
      timestamp,
      CATEGORY,
      subCategory || this.subCategory,
      '/'
    );
  }

  makeMetadataPrefix() {
    return this.makeNamedPrefix(this.subCategory, METADATA);
  }

  makeVttPrefix() {
    return this.makeNamedPrefix(this.subCategory, VTT);
  }

  makeTimeseriesPrefix() {
    return this.makeNamedPrefix(this.subCategory, TIMESERIES);
  }

  makeEdlPrefix() {
    return this.makeNamedPrefix(this.subCategory, EDL);
  }

  makeNamedPrefix(subCategory, name) {
    const data = this.stateData.data[subCategory];
    return PATH.join(
      data.prefix,
      name,
      subCategory,
      '/'
    );
  }
}

module.exports = BaseCreateTrackIterator;
