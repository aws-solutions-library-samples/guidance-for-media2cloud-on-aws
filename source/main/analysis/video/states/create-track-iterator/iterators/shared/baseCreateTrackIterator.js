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
const TIMESERIES = 'timeseries';
const METADATA = 'metadata';
const VTT = 'vtt';
const EDL = 'edl';
const FRAME_SEGMENTATION = 'framesegmentation';

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

  async downloadJson(bucket, key, name) {
    return CommonUtils.download(bucket, key)
      .then((res) =>
        this.filterBy(
          name,
          JSON.parse(res)
        ))
      .catch((e) => {
        console.error(e);
        return [];
      });
  }

  /* derived class to implement */
  filterBy(name, data) {
    return [];
  }

  /* derived class to implement */
  createTimeseriesData(name, data) {
    return undefined;
  }

  async getMapData(bucket, key) {
    return CommonUtils.download(
      bucket,
      key
    ).then((res) =>
      JSON.parse(res))
      .catch((e) => {
        console.error(e);
        return undefined;
      });
  }

  async getDataFile(bucket, key) {
    return CommonUtils.download(
      bucket,
      key
    ).then((res) =>
      JSON.parse(res))
      .catch((e) => {
        console.error(e);
        return undefined;
      });
  }

  async process() {
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const key = data.output;
    const prefix = PATH.parse(key).dir;

    const mapData = await this.getMapData(
      bucket,
      key
    );
    if (!mapData || !mapData.data || !mapData.data.length) {
      return this.setCompleted();
    }

    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const _key = PATH.join(prefix, mapData.file);
    const dataset = await this.getDataFile(bucket, _key);
    if (!dataset) {
      return this.setCompleted();
    }

    let lambdaTimeout = false;
    const uniques = mapData.data
      .splice(data.cursor);

    let count = 0;
    const t0 = new Date();
    while (!lambdaTimeout && uniques.length > 0) {
      const name = uniques.shift();
      await this.processTrack(
        name,
        dataset
      );
      data.cursor += 1;
      count += 1;
      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.stateData.quitNow();
    }

    const remained = this.stateData.getRemainingTime();
    const consumed = new Date() - t0;
    console.log(`COMPLETED: ${count} names [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);

    if (uniques.length > 0) {
      const total = data.cursor + uniques.length;
      return this.setProgress(Math.round((data.cursor / total) * 100));
    }
    return this.setCompleted();
  }

  async processTrack(name, dataset) {
    const promises = [];
    const stateData = this.stateData.data[this.subCategory];
    const bucket = stateData.bucket;

    const appearances = this.filterBy(name, dataset);
    /* #1.1: create timelines */
    const timelines = this.createTimelines(name, appearances);
    /* #2: create and upload timeseries data */
    let oPrefix;

    if (this.enableTimeseries) {
      const timeseries = this.createTimeseriesData(name, appearances);
      if (timeseries) {
        /* compute show rate, duration and appearance */
        timeseries.duration = stateData.duration || 1;
        let appearance = 0;
        if (timelines) {
          appearance = timelines
            .reduce((a0, c0) =>
              a0 + (c0.end - c0.begin), 0);
        }
        timeseries.appearance = Math.round(appearance);
        oPrefix = this.makeTimeseriesPrefix();
        promises.push(this.mergeAndUploadFile(
          bucket,
          oPrefix,
          `${this.subCategory}.json`,
          {
            [name]: timeseries,
          }
        ));
        stateData.timeseries = PATH.join(oPrefix, `${this.subCategory}.json`);
      }
    }

    /* #3: create metadata and vtt data */
    if (timelines) {
      if (this.enableMetadata) {
        oPrefix = this.makeMetadataPrefix();
        const metadata = timelines
          .map((x) =>
            x.toJSON());
        promises.push(this.mergeAndUploadFile(
          bucket,
          oPrefix,
          `${this.subCategory}.json`,
          {
            [name]: metadata,
          }
        ));
        stateData.metadata = PATH.join(oPrefix, `${this.subCategory}.json`);
      }

      if (this.enableVtt) {
        oPrefix = this.makeVttPrefix();
        const vtt = this.createWebVtt(name, timelines);
        promises.push(this.mergeAndUploadFile(
          bucket,
          oPrefix,
          `${this.subCategory}.json`,
          {
            [name]: vtt.toString(),
          }
        ));
        stateData.vtt = PATH.join(oPrefix, `${this.subCategory}.json`);
      }
    }

    return Promise.all(promises);
  }

  createTimelines(name, dataset) {
    const data = this.stateData.data[this.subCategory];
    const options = {
      name,
    };

    if (data.sampling) {
      options.timeDriftExceedThreshold = Math.round(data.sampling * 1.2);
    }
    const timelines = [];
    const queue = new TimelineQ();
    for (let i = 0; i < dataset.length; i++) {
      const item = TimelineQ.createTypedItem(dataset[i], options);
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

    timelines.sort((a, b) =>
      a.begin - b.begin);

    // pad end time to have at least 1s
    timelines.forEach((x) => {
      if ((x.end - x.begin) <= 0) {
        x.end = x.begin + 900;
      }
    });

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
    const merged = {
      startTime: data.startTime,
      endTime: data.endTime || Date.now(),
      backlogId: data.backlogId,
      jobId: data.jobId,
      numOutputs: data.numOutputs,
      bucket: data.bucket,
      output: data.output,
      timeseries: data.timeseries,
      metadata: data.metadata,
      vtt: data.vtt,
      edl: data.edl,
      apiCount: data.apiCount,
      ...params,
    };
    this.stateData.data[this.subCategory] = merged;
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
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(data.prefix, 'raw', timestamp, CATEGORY, subCategory || this.subCategory, '/');
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
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(data.prefix, name, subCategory, '/');
  }

  async mergeAndUploadFile(
    bucket,
    prefix,
    name,
    data
  ) {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, name);
    const merged = await CommonUtils.download(
      bucket,
      key
    ).then((res) => {
      const json = JSON.parse(res);
      return {
        ...json,
        ...data,
      };
    }).catch(() =>
      data);
    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      merged
    );
  }
}

module.exports = BaseCreateTrackIterator;
