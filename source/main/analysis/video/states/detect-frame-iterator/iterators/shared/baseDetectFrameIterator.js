// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const PATH = require('path');
const {
  RekognitionClient,
} = require('@aws-sdk/client-rekognition');
const {
  StateData,
  CommonUtils,
  Environment,
  MapDataVersion,
  FrameCaptureModeHelper,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');

const CATEGORY = 'rekognition';
const FRAMECAPTURE_PREFIX = 'frame';
const MAP_FILENAME = 'mapFile.json';
const DATA_FILENAME = '00000000.json';
const SKIP_FRAME_ANALYSIS = [
  'ColorBars',
  'BlackFrames',
  'StudioLogo',
  'Slate',
  'EndCredits',
  'OpeningCredits',
  // 'Content',
  // 'undefined',
];

const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class BaseDetectFrameIterator {
  constructor(stateData, subCategory, namedKey) {
    if (!(stateData instanceof StateData)) {
      throw new M2CException('stateData not StateData object');
    }
    /* detection type such as label, celeb, and etc */
    if (!subCategory) {
      throw new M2CException('subCategory not specified');
    }
    /* JSON output file's root key */
    if (!namedKey) {
      throw new M2CException('namedKey not specified');
    }

    if (stateData.data[subCategory].apiCount === undefined) {
      stateData.data[subCategory].apiCount = 0;
    }

    this.$stateData = stateData;
    this.$subCategory = subCategory;
    this.$namedKey = namedKey;
    this.$paramOptions = undefined;
    this.$dataset = [];
    this.$mapData = [];
    this.$modelMetadata = undefined;
    this.$originalResponse = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'BaseDetectFrameIterator';
  }

  get stateData() {
    return this.$stateData;
  }

  get subCategory() {
    return this.$subCategory;
  }

  get namedKey() {
    return this.$namedKey;
  }

  get paramOptions() {
    return this.$paramOptions;
  }

  set paramOptions(val) {
    this.$paramOptions = val;
  }

  get dataset() {
    return this.$dataset;
  }

  set dataset(val) {
    this.$dataset = val;
  }

  get mapData() {
    return this.$mapData;
  }

  set mapData(val) {
    this.$mapData = val;
  }

  get modelMetadata() {
    return this.$modelMetadata;
  }

  set modelMetadata(val) {
    this.$modelMetadata = val;
  }

  get minConfidence() {
    return this.stateData.data[this.subCategory].minConfidence;
  }

  get originalResponse() {
    return this.$originalResponse;
  }

  set originalResponse(val) {
    this.$originalResponse = val;
  }

  /* derived class to implement */
  async detectFrame(bucket, key, frameNo, timestamp) {
    throw new M2CException('dervied class to implement detectFrame');
  }

  /* derived class to implement */
  getUniqueNames(dataset) {
    throw new M2CException('dervied class to implement getUniqueNames');
  }

  async process() {
    if (this.stateData.data.framesegmentation) {
      return this.processWithFrameSegmentation();
    }

    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const prefix = data.frameCapture.prefix;
    const outPrefix = this.makeRawDataPrefix(this.subCategory);
    const numFrames = data.frameCapture.numFrames;

    data.startTime = data.startTime || Date.now();
    let lambdaTimeout = false;

    const t0 = new Date();
    while (!lambdaTimeout && data.cursor < numFrames) {
      await this.processFrame(
        bucket,
        prefix,
        data.cursor++
      );
      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.stateData.quitNow();
    }

    this.mapData = this.getUniqueNames(this.dataset);
    await this.updateOutputs(bucket, outPrefix);

    const consumed = new Date() - t0;
    const remained = this.stateData.getRemainingTime();
    console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);

    return (data.cursor >= numFrames)
      ? this.setCompleted()
      : this.setProgress(Math.round((data.cursor / numFrames) * 100));
  }

  async processFrame(
    bucket,
    prefix,
    idx
  ) {
    const data = this.stateData.data[this.subCategory];
    const frameCapture = data.frameCapture;
    const name = BaseDetectFrameIterator.makeFrameCaptureFileName(idx);
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, name);

    const [
      frameNo,
      timestamp,
    ] = FrameCaptureModeHelper.computeFrameNumAndTimestamp(
      idx,
      data.framerate,
      frameCapture
    );

    const dataset = await this.detectFrame(
      bucket,
      key,
      frameNo,
      timestamp
    );

    if (dataset) {
      this.dataset = this.dataset.concat(dataset);
    }

    return dataset;
  }

  async detectFn(command) {
    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    return rekognitionClient.send(command)
      .then((res) => {
        // report api calls and new faces indexed
        this.stateData.data[this.subCategory].apiCount += 1;
        this.originalResponse = res;
        delete res.$metadata;
        return res;
      })
      .catch((e) => {
        if (((command.input || {}).Image || {}).Bytes !== undefined) {
          delete command.input.Image.Bytes;
        }
        console.warn(
          'WARN:',
          'BaseDetectFrameIterator.detectFn:',
          `${command.constructor.name}:`,
          e.$metadata.httpStatusCode,
          e.name,
          e.message,
          JSON.stringify(command.input)
        );
        return undefined;
      });
  }

  async updateOutputs(bucket, prefix) {
    return Promise.all([
      this.updateDataFile(bucket, prefix, DATA_FILENAME, this.dataset),
      this.updateMapFile(bucket, prefix, MAP_FILENAME, this.mapData, DATA_FILENAME),
    ]);
  }

  async updateMapFile(
    bucket,
    prefix,
    name,
    mapData,
    dataFile
  ) {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, name);
    let merged = await CommonUtils.download(
      bucket,
      key
    ).then((x) =>
      JSON.parse(x).data)
      .catch(() =>
        ([]));

    merged = {
      version: MapDataVersion,
      file: dataFile,
      data: [
        ...new Set(merged.concat(mapData)),
      ],
    };

    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      merged
    ).catch((e) =>
      console.error(e));
  }

  async updateDataFile(
    bucket,
    prefix,
    name,
    dataset
  ) {
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, name);
    let merged = await CommonUtils.download(
      bucket,
      key
    ).then((x) =>
      JSON.parse(x))
      .catch(() => ({
        [this.namedKey]: [],
      }));

    merged = {
      ...this.modelMetadata,
      [this.namedKey]: merged[this.namedKey]
        .concat(dataset),
    };

    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      merged
    ).catch((e) =>
      console.error(e));
  }

  makeParams(bucket, key, options) {
    if ((!bucket || !key) && !((options || {}).Image || {}).Bytes) {
      throw new M2CException('bucket and key or Image.Bytes must be specified');
    }
    return {
      Image: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
      ...options,
    };
  }

  makeRawDataPrefix(subCategory) {
    const data = this.stateData.data[subCategory];
    const timestamp = CommonUtils.toISODateTime(data.requestTime);
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return PATH.join(data.prefix, 'raw', timestamp, CATEGORY, subCategory, '/');
  }

  setCompleted() {
    const data = this.stateData.data[this.subCategory];
    data.cursor = 0;
    data.endTime = Date.now();
    data.output = PATH.join(
      this.makeRawDataPrefix(this.subCategory),
      MAP_FILENAME
    );
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  setProgress(pencentage) {
    this.stateData.setProgress(pencentage);
    return this.stateData.toJSON();
  }

  static makeFrameCaptureFileName(frameNo) {
    return `${FRAMECAPTURE_PREFIX}.${frameNo.toString().padStart(7, '0')}.jpg`;
  }

  async processWithFrameSegmentation() {
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;

    const frameSegmentationJson = this.stateData.data.framesegmentation.key;
    const frameSegmentation = await CommonUtils.download(bucket, frameSegmentationJson)
      .then((res) =>
        JSON.parse(res));

    console.log(
      '=== Using processWithFrameSegmentation: numFrames:',
      frameSegmentation.length
    );
    const numFrames = frameSegmentation.length;
    const prefix = PATH.parse(frameSegmentationJson).dir;
    const outPrefix = this.makeRawDataPrefix(this.subCategory);

    data.startTime = data.startTime || Date.now();

    const t0 = new Date();
    let lambdaTimeout = false;

    while (!lambdaTimeout && data.cursor < numFrames) {
      const frame = frameSegmentation[data.cursor];
      await this.processFrame2(
        bucket,
        prefix,
        frame
      );
      data.cursor += 1;
      /* make sure we allocate enough time for the next iteration */
      lambdaTimeout = this.stateData.quitNow();
    }

    this.mapData = this.getUniqueNames(this.dataset);
    await this.updateOutputs(bucket, outPrefix);

    const consumed = new Date() - t0;
    const remained = this.stateData.getRemainingTime();
    console.log(`COMPLETED: frame #${data.cursor - 1} [Consumed/Remained: ${consumed / 1000}s / ${remained / 1000}s]`);

    if (data.cursor >= numFrames) {
      return this.setCompleted();
    }

    let percentage = (data.cursor / numFrames) * 100;
    percentage = Math.round(percentage);

    return this.setProgress(percentage);
  }

  async processFrame2(
    bucket,
    prefix,
    frame
  ) {
    if (this.skipFrame(frame)) {
      return undefined;
    }

    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, frame.name);

    const dataset = await this.detectFrame(
      bucket,
      key,
      frame.frameNo,
      frame.timestamp
    );

    if (dataset) {
      this.dataset = this.dataset.concat(dataset);
    }

    return dataset;
  }

  skipFrame(frame) {
    return SKIP_FRAME_ANALYSIS
      .includes((frame || {}).technicalCueType);
  }

  static async RunCommand(command) {
    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    return rekognitionClient.send(command);
  }
}

module.exports = BaseDetectFrameIterator;
