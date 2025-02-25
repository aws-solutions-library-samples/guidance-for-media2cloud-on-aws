// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PATH = require('node:path');
const {
  AnalysisTypes: {
    Rekognition: {
      Segment,
    },
  },
  CommonUtils,
  WebVttTrack,
  EDLComposer,
  AdmZip,
} = require('core-lib');
const BaseCreateTrackIterator = require('../shared/baseCreateTrackIterator');

// ColorBars | EndCredits | BlackFrames | OpeningCredits | StudioLogo | Slate | Content
const CUE_ABBREV = {
  OpeningCredits: 'OPENI',
  EndCredits: 'ENDCRD',
  BlackFrames: 'BLACK',
  ColorBars: 'COLOR',
  StudioLogo: 'STUDIO',
  Slate: 'SLATE',
  Content: 'CONTEN',
};

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
    super(stateData, Segment);
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
    const data = this.stateData.data[Segment];
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

    const dataset = await this.getDataFile(
      bucket,
      PATH.join(prefix, mapData.file)
    );
    if (!dataset
      || !dataset.Segments
      || !dataset.Segments.length) {
      return this.setCompleted();
    }

    await this.processTrack(
      undefined,
      dataset
    );

    return this.setCompleted();
  }

  async processTrack(name, dataset, shotSegments) {
    const data = this.stateData.data[Segment];
    const bucket = data.bucket;
    const title = PATH.parse(data.key).name
      .replace(/[\W_]+/g, ' ');

    const detections = {};
    dataset.Segments
      .forEach((segment, idx) => {
        let item;

        if (segment.ShotSegment !== undefined) {
          item = _makeShotSegmentItem(segment, detections);
        } else if (segment.TechnicalCueSegment !== undefined) {
          item = _makeTechnicalCueItem(segment, detections);
        }

        if (item !== undefined) {
          if (detections[item.type] === undefined) {
            detections[item.type] = [];
          }
          detections[item.type].push(item);
        }
      });

    await Promise.all([
      this.createWebVttFiles(
        bucket,
        this.makeVttPrefix(),
        `${Segment}.json`,
        detections
      ),
      this.createMetadataFiles(
        bucket,
        this.makeMetadataPrefix(),
        `${Segment}.json`,
        detections
      ),
      this.createEdlZipFile(
        bucket,
        this.makeEdlPrefix(),
        `${Segment}.zip`,
        title,
        detections
      ),
    ]);
    return detections;
  }

  async createWebVttFiles(
    bucket,
    prefix,
    name,
    detections
  ) {
    const vtts = Object.keys(detections)
      .filter((x) =>
        detections[x] && detections[x].length > 0)
      .reduce((a0, c0) => ({
        ...a0,
        [c0]: this.createWebVttText(
          detections[c0],
          (c0 === TYPE_SHOT)
            ? CUE_ALIGNMENT_START
            : CUE_ALIGNMENT_END
        ),
      }), {});

    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      vtts
    ).then(() => {
      const key = PATH.join(prefix, name);
      this.stateData.data[Segment].vtt = key;
      return key;
    }).catch((e) => {
      console.error(e);
      return undefined;
    });
  }

  async createMetadataFiles(
    bucket,
    prefix,
    name,
    detections
  ) {
    const metadata = Object.keys(detections)
      .filter((x) =>
        detections[x] && detections[x].length > 0)
      .reduce((a0, c0) => ({
        ...a0,
        [c0]: detections[c0],
      }), {});

    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      metadata
    ).then(() => {
      const key = PATH.join(prefix, name);
      this.stateData.data[Segment].metadata = key;
      return key;
    }).catch((e) => {
      console.error(e);
      return undefined;
    });
  }

  async createEdlZipFile(
    bucket,
    prefix,
    name,
    title,
    detections
  ) {
    const zip = new AdmZip();
    Object.keys(detections)
      .filter((x) =>
        detections[x] && detections[x].length > 0)
      .forEach((x) => {
        const events = detections[x]
          .map((item, idx) => ({
            id: idx + 1,
            reelName: item.name,
            clipName: title,
            startTime: item.smpteBegin,
            endTime: item.smpteEnd,
          }));

        const edl = new EDLComposer({
          title,
          events,
        });

        const buf = Buffer.from(edl.compose(), 'utf8');
        zip.addFile(`${x}.edl`, buf, x);
      });

    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      zip.toBuffer()
    ).then(() => {
      const key = PATH.join(prefix, name);
      this.stateData.data[Segment].edl = key;
      return key;
    }).catch((e) => {
      console.error(e);
      return undefined;
    });
  }

  createWebVttText(items, placement) {
    const track = new WebVttTrack();
    items.forEach((x) => {
      const cueText = [
        x.name,
        `<c.confidence>(${Math.round(x.confidence)}%)</c>`,
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
}

function _makeShotSegmentItem(segment, detections) {
  const {
    ShotSegment: {
      Index,
      Confidence,
    },
  } = segment;

  const name = `${TYPE_SHOT} ${String(Index).padStart(3, '0')}`;

  return _makeItem(segment, TYPE_SHOT, name, Confidence);
}

function _makeTechnicalCueItem(segment, detections) {
  const {
    TechnicalCueSegment: {
      Type,
      Confidence,
    },
  } = segment;

  let name = CUE_ABBREV[Type];
  if (!name) {
    name = Type.substring(0, 5).toUpperCase();
  }

  const padding = 8 - name.length;
  const index = String((detections[Type] || []).length)
    .padStart(padding, '0');

  name = `${name}${index}`;

  return _makeItem(segment, Type, name, Confidence);
}

function _makeItem(segment, type, name, confidence) {
  const {
    StartTimestampMillis: begin,
    EndTimestampMillis: end,
    StartTimecodeSMPTE: smpteBegin,
    EndTimecodeSMPTE: smpteEnd,
  } = segment;

  const item = {
    type,
    name,
    confidence: Number(confidence.toFixed(2)),
    begin,
    end,
    smpteBegin,
    smpteEnd,
  };

  return item;
}

module.exports = CreateSegmentTrackIterator;
