/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const PATH = require('path');
const {
  AnalysisTypes,
  CommonUtils,
  WebVttTrack,
  EDLComposer,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Segment;
const TYPE_TECHNICAL_CUE = 'TECHNICAL_CUE';
const TYPE_SHOT = 'SHOT';
const SHOT_SEGMENT_BASENAME = 'shot_segments';
const TECHNICAL_CUE_BASENAME = 'technical_cues';

class CreateSegmentTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
    this.$shots = [];
    this.$cues = [];
  }

  get [Symbol.toStringTag]() {
    return 'CreateSegmentTrackIterator';
  }

  get enableTimeseries() {
    return false;
  }

  get enableEdl() {
    return true;
  }

  get shots() {
    return this.$shots;
  }

  get cues() {
    return this.$cues;
  }

  async process() {
    const data = this.stateData.data[SUBCATEGORY];
    while (data.cursor < data.numOutputs) {
      const t0 = new Date();
      await this.processTrack(data.cursor);
      data.cursor++;
      /* make sure we allocate enough time for the next iteration */
      const remained = this.stateData.getRemainingTime();
      const consumed = new Date() - t0;
      console.log(`COMPLETED: : '${data.cursor - 1}' [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);
      if (this.stateData.quitNow() || (remained - (consumed * 1.2) <= 0)) {
        break;
      }
    }
    const promises = [];
    if (this.shots.length) {
      promises.splice(promises.length, 0, ...[
        this.createShotSegmentTrack(),
        this.createShotSegmentMetadata(),
        this.createShotSegmentEDLFile(),
      ]);
    }
    if (this.cues.length) {
      promises.splice(promises.length, 0, ...[
        this.createTechnicalCueTrack(),
        this.createTechnicalCueMetadata(),
        this.createTechnicalCueEDLFile(),
      ]);
    }
    await Promise.all(promises);
    return (data.cursor < data.numOutputs)
      ? this.setProgress(Math.round((data.cursor / data.numOutputs) * 100))
      : this.setCompleted();
  }

  async processTrack(idx) {
    const data = this.stateData.data[SUBCATEGORY];
    const prefix = this.makeRawDataPrefix(SUBCATEGORY);
    const name = CreateSegmentTrackIterator.makeSequenceFileName(idx);
    const segments = await CommonUtils.download(data.bucket, PATH.join(prefix, name), false)
      .then(x =>
        JSON.parse(x.Body.toString()).Segments.Segments)
      .catch(e => console.error(e));
    const shots = [];
    const cues = [];
    while (segments && segments.length) {
      const segment = segments.shift();
      if (segment.Type === TYPE_TECHNICAL_CUE) {
        cues.push({
          name: segment.TechnicalCueSegment.Type,
          confidence: segment.TechnicalCueSegment.Confidence,
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      } else if (segment.Type === TYPE_SHOT) {
        shots.push({
          name: `Shot #${segment.ShotSegment.Index}`,
          confidence: segment.ShotSegment.Confidence,
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      }
    }
    this.shots.splice(this.shots.length, 0, ...shots);
    this.cues.splice(this.cues.length, 0, ...cues);
    return [
      this.shots,
      this.cues,
    ];
  }

  async createShotSegmentTrack() {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeVttPrefix();
    const name = `${SHOT_SEGMENT_BASENAME}.vtt`;
    const body = this.createWebVtt(this.shots, {
      line: 0,
      position: 0,
      align: 'start',
    });
    return CommonUtils.uploadFile(bucket, prefix, name, body);
  }

  async createShotSegmentMetadata() {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeMetadataPrefix();
    const name = `${SHOT_SEGMENT_BASENAME}.json`;
    return CommonUtils.uploadFile(bucket, prefix, name, this.shots);
  }

  async createShotSegmentEDLFile() {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeEdlPrefix();
    const name = `${SHOT_SEGMENT_BASENAME}.edl`;
    const body = this.convertJsonToEDL(this.shots);
    return CommonUtils.uploadFile(bucket, prefix, name, body);
  }

  async createTechnicalCueTrack() {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeVttPrefix();
    const name = `${TECHNICAL_CUE_BASENAME}.vtt`;
    const body = this.createWebVtt(this.cues, {
      line: 0,
      position: 100,
      align: 'end',
    });
    return CommonUtils.uploadFile(bucket, prefix, name, body);
  }

  async createTechnicalCueMetadata() {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeMetadataPrefix();
    const name = `${TECHNICAL_CUE_BASENAME}.json`;
    return CommonUtils.uploadFile(bucket, prefix, name, this.cues);
  }

  async createTechnicalCueEDLFile() {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeEdlPrefix();
    const name = `${TECHNICAL_CUE_BASENAME}.edl`;
    const body = this.convertJsonToEDL(this.cues);
    return CommonUtils.uploadFile(bucket, prefix, name, body);
  }

  createWebVtt(items, placement) {
    const track = new WebVttTrack();
    items.forEach((x) => {
      const cueText = [
        x.name,
        `<c.confidence>(${Number.parseFloat(x.confidence).toFixed(2)})</c>`,
      ].join(' ');
      const cueAlignment = [
        `align:${placement.align}`,
        `line:${placement.line}%`,
        `position:${placement.position}%`,
        'size:25%',
      ].join(' ');
      track.addCue(x.begin, x.end, cueText, cueAlignment);
    });
    return track.toString();
  }

  convertJsonToEDL(dataset) {
    const data = this.stateData.data[SUBCATEGORY];
    const parsed = PATH.parse(data.key);
    const events = [];
    for (let i = 0; i < dataset.length; i++) {
      events.push({
        id: i + 1,
        reelName: dataset[i].name,
        startTime: dataset[i].smpteBegin,
        endTime: dataset[i].smpteEnd,
        clipName: parsed.base,
      });
    }
    const edl = new EDLComposer({
      title: parsed.name.replace(/[\W_]+/g, ' '),
      events,
    });
    return edl.compose();
  }

  static makeSequenceFileName(idx) {
    return `${String(idx).padStart(8, '0')}.json`;
  }
}

module.exports = CreateSegmentTrackIterator;
