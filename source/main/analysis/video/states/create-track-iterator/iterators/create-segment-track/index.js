// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('path');
const {
  AnalysisTypes,
  CommonUtils,
  WebVttTrack,
  EDLComposer,
  AdmZip,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

const SUBCATEGORY = AnalysisTypes.Rekognition.Segment;
const TYPE_SHOT = 'SHOT';
const CUE_ALIGNMENT_START = {
  line: 0,
  position: 0,
  align: 'start',
};
const CUE_ALIGNMENT_END = {
  line: 0,
  position: 100,
  align: 'end',
};

class CreateSegmentTrackIterator extends BaseCreateTrackIterator {
  constructor(stateData) {
    super(stateData, SUBCATEGORY);
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

  async process() {
    const data = this.stateData.data[SUBCATEGORY];
    const detections = {};
    while (data.cursor < data.numOutputs) {
      const processed = await this.processTrack(data.cursor);
      Object.keys(processed).map((x) => {
        if (detections[x] === undefined) {
          detections[x] = [];
        }
        return detections[x].splice(detections[x].length, 0, ...processed[x]);
      });
      data.cursor++;
    }
    /* create webvtt track */
    await this.createWebVttFiles(detections);
    /* create metadata files */
    await this.createMetadataFiles(detections);
    /* create EDL zip package */
    await this.createEdlZipFile(detections);
    return (data.cursor < data.numOutputs)
      ? this.setProgress(Math.round((data.cursor / data.numOutputs) * 100))
      : this.setCompleted();
  }

  async processTrack(idx) {
    const data = this.stateData.data[SUBCATEGORY];
    const prefix = this.makeRawDataPrefix(SUBCATEGORY);
    const name = CreateSegmentTrackIterator.makeSequenceFileName(idx);
    const detections = {};
    const segments = await CommonUtils.download(data.bucket, PATH.join(prefix, name), false)
      .then((x) =>
        JSON.parse(x.Body.toString()).Segments.Segments)
      .catch(e => console.error(e));
    while (segments && segments.length) {
      const segment = segments.shift();
      if (segment.Type === TYPE_SHOT) {
        const typed = segment.Type.toLowerCase();
        if (detections[typed] === undefined) {
          detections[typed] = [];
        }
        detections.shot.push({
          type: segment.Type,
          name: `Shot ${segment.ShotSegment.Index.toString().padStart(3, '0')}`,
          confidence: Number(Number(segment.ShotSegment.Confidence).toFixed(2)),
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      } else {
        const typed = segment.TechnicalCueSegment.Type.toLowerCase();
        if (detections[typed] === undefined) {
          detections[typed] = [];
        }
        detections[typed].push({
          type: segment.TechnicalCueSegment.Type,
          name: `${segment.TechnicalCueSegment.Type.substring(0, 5)}${String(detections[typed].length).padStart(3, '0')}`,
          confidence: segment.TechnicalCueSegment.Confidence,
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      }
    }
    return detections;
  }

  async createWebVttFiles(detections) {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeVttPrefix();
    const promises = Object.values(detections).map((data) => {
      if (!data || data.length === 0) {
        return undefined;
      }
      const type = data[0].type;
      const name = `${type.toLowerCase()}.vtt`;
      const alignment = (type === TYPE_SHOT)
        ? CUE_ALIGNMENT_START
        : CUE_ALIGNMENT_END;
      const body = this.createWebVtt(data, alignment);
      return CommonUtils.uploadFile(bucket, prefix, name, body);
    });
    return Promise.all(promises);
  }

  async createEdlZipFile(detections) {
    const zip = new AdmZip();
    const parsed = PATH.parse(this.stateData.data[SUBCATEGORY].key);
    const title = parsed.name.replace(/[\W_]+/g, ' ');

    Object.values(detections).forEach((data) => {
      if (data.length === 0) {
        return;
      }
      const type = data[0].type.toLowerCase();
      const events = data.map((item, idx) => ({
        id: idx + 1,
        reelName: item.name,
        clipName: parsed.base,
        startTime: item.smpteBegin,
        endTime: item.smpteEnd,
      }));
      const edl = new EDLComposer({
        title,
        events,
      });
      const buf = Buffer.from(edl.compose(), 'utf8');
      zip.addFile(`${type}.edl`, buf, type);
    });
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeEdlPrefix();
    const name = `${SUBCATEGORY}.zip`;
    return CommonUtils.uploadFile(bucket, prefix, name, zip.toBuffer());
  }

  async createMetadataFiles(detections) {
    const bucket = this.stateData.data[SUBCATEGORY].bucket;
    const prefix = this.makeMetadataPrefix();
    const promises = Object.values(detections).map((data) => {
      if (!data || data.length === 0) {
        return undefined;
      }
      const type = data[0].type;
      const name = `${type.toLowerCase()}.json`;
      return CommonUtils.uploadFile(bucket, prefix, name, data);
    });
    return Promise.all(promises);
  }

  createWebVtt(items, placement) {
    const track = new WebVttTrack();
    items.forEach((x) => {
      const cueText = [
        x.name,
        `<c.confidence>(${x.confidence})</c>`,
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

  static makeSequenceFileName(idx) {
    return `${String(idx).padStart(8, '0')}.json`;
  }
}

module.exports = CreateSegmentTrackIterator;
