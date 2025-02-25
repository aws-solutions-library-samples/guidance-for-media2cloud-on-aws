// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  StateData,
  AnalysisError,
  CommonUtils: {
    download,
    uploadFile,
    toISODateTime,
    toHHMMSS,
  },
  TimelineQ,
  WebVttTrack,
  AnalysisTypes: {
    Rekognition: {
      Segment,
    },
  },
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
    return download(bucket, key)
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
    return download(
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
    return download(
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

    let shotSegments;
    if (this.useSegment()) {
      shotSegments = await this.downloadSegments();
    }

    let count = 0;
    const t0 = new Date();
    while (!lambdaTimeout && uniques.length > 0) {
      const name = uniques.shift();
      await this.processTrack(
        name,
        dataset,
        shotSegments
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

  async processTrack(name, dataset, shotSegments) {
    const promises = [];

    const stateData = this.stateData.data[this.subCategory];
    const bucket = stateData.bucket;

    const appearances = this.filterBy(name, dataset);
    /* #1.1: create timelines */
    let timelines;
    if (shotSegments) {
      timelines = this.createTimelinesWithSegments(name, appearances, shotSegments);
    } else {
      timelines = this.createTimelines(name, appearances);
    }
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
    const timestamp = toISODateTime(data.requestTime);
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
    const merged = await download(
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
    return uploadFile(
      bucket,
      prefix,
      name,
      merged
    );
  }

  async downloadSegments() {
    // check to see if segment detection is enabled.
    const {
      data: {
        [this.subCategory]: { bucket: proxyBucket },
        [Segment]: segment = {},
      },
    } = this.stateData;

    if (!proxyBucket || !segment.output) {
      return undefined;
    }

    let output = PATH.join(PATH.parse(segment.output).dir, '00000000.json');
    output = await download(proxyBucket, output)
      .then((res) =>
        JSON.parse(res))
      .catch(() =>
        undefined);

    output = output.Segments.filter((segment) =>
      segment.ShotSegment !== undefined);

    return output;
  }

  // merge datapoint with shot segment timestamps?
  useSegment() {
    return false;
  }

  // aggregate shot timestamps to the results
  createTimelinesWithSegments(name, dataset, shotSegments) {
    const aggregated = [];

    for (const shot of shotSegments) {
      const {
        StartTimestampMillis: tsta,
        EndTimestampMillis: tend,
        ShotSegment: { Index: shotId },
        FrameRange: frameRange = [],
      } = shot;

      // frames extracted within this shot segment
      let numFramesExtracted = 0;
      if (frameRange.length === 2) {
        numFramesExtracted = frameRange[1] - frameRange[0] + 1
      }

      const hit = {
        shotId,
        tsta,
        tend,
        numFramesExtracted,
        items: [],
      };

      for (const item of dataset) {
        const { Timestamp: t } = item;
        if (tsta <= t && t <= tend) {
          hit.items.push(item);
        }
      }

      if (hit.items.length > 0) {
        aggregated.push(hit);
      }
    }

    const timelines = [];
    for (const item of aggregated) {
      const { tsta, tend, numFramesExtracted, items } = item;
      const item0 = items[0];
      const timeItem = TimelineQ.createTypedItem(item0, {
        name,
      });

      const timestamps = [];
      const frameNums = [];
      let durations = 0;
      for (const item of items) {
        const { Timestamp: t, FrameNumber: frameNum, ExtendFrameDuration: duration } = item;
        timestamps.push(t);
        frameNums.push(frameNum);
        if (duration !== undefined) {
          durations += duration;
        }
      }
      timestamps.sort((a, b) => a - b);
      frameNums.sort((a, b) => a - b);

      const tmin = timestamps[0];
      const tmax = timestamps[timestamps.length - 1] + durations;
      const fmin = frameNums[0];
      const fmax = frameNums[frameNums.length - 1];

      // should we roll up to shot level?
      console.log(`Shot [${toHHMMSS(tsta, true)} - ${toHHMMSS(tend, true)}](${tend - tsta}ms) : ${name} [${toHHMMSS(tmin, true)} - ${toHHMMSS(tmax, true)}][${fmin} - ${fmax}] (${tmax - tmin}ms) [${((tmax - tmin) / (tend - tsta)).toFixed(3)}] [${numFramesExtracted} frames extracted]`);

      let begin = tmin;
      let end = tmax;

      // roll up to segment timestamp to cover the whole shot
      // if timestamps more than 80%
      if ((end - begin) / (tend - tsta) > 0.799) {
        begin = tsta;
        end = tend;
      }

      // extremely short segment
      if ((end - begin) < 10) {
        // pad to 800ms at the minimum
        end = begin + 800;
        // roll up to segment timestamp
        if (numFramesExtracted < 2) {
          begin = tsta;
          end = tend;
        }
      }

      timeItem.begin = begin;
      timeItem.end = end;
      timeItem.count = items.length;
      timelines.push(timeItem);
    }

    return timelines;
  }
}

module.exports = BaseCreateTrackIterator;
