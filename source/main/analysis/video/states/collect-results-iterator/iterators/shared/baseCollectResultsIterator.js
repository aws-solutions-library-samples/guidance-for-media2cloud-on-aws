// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const PATH = require('path');
const {
  RekognitionClient,
} = require('@aws-sdk/client-rekognition');
const {
  StateData,
  CommonUtils,
  MapDataVersion,
  Environment,
  xraysdkHelper,
  retryStrategyHelper,
  M2CException,
} = require('core-lib');

const CATEGORY = 'rekognition';
const MAX_SAMPLING_RATE = 2000; // 2s max sampling rate
const MIN_SAMPLING_RATE = 800; // min 800ms
const MAP_FILENAME = 'mapFile.json';
const DATA_FILENAME = '00000000.json';

const CUSTOM_USER_AGENT = Environment.Solution.Metrics.CustomUserAgent;

class BaseCollectResultsIterator {
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
    this.$stateData = stateData;
    this.$subCategory = subCategory;
    this.$namedKey = namedKey;
    this.$dataset = [];
    this.$mapData = [];
    this.$paramOptions = undefined;
    this.$modelMetadata = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'BaseCollectResultsIterator';
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

  get paramOptions() {
    return this.$paramOptions;
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

  async process() {
    const data = this.stateData.data[this.subCategory];
    if (!data.jobId) {
      throw new M2CException(`missing data.${this.subCategory}.jobId`);
    }

    data.nextToken = await this.processResults(data.jobId);
    data.numOutputs = 1;

    return (!data.nextToken)
      ? this.setCompleted()
      : this.setProgress(data.numOutputs);
  }

  async processResults(jobId) {
    const data = this.stateData.data[this.subCategory];
    const bucket = data.bucket;
    const prefix = this.makeRawDataPrefix(this.subCategory);

    let nextToken = data.nextToken;
    let lambdaTimeout;
    do {
      const response = await this.getDetectionResults({
        ...this.paramOptions,
        JobId: jobId,
        NextToken: nextToken,
      });
      nextToken = this.collectResults(response);
      lambdaTimeout = this.stateData.quitNow();
    } while (nextToken !== undefined && !lambdaTimeout);

    if (!data.sampling) {
      data.sampling = BaseCollectResultsIterator.computeSampling(this.dataset);
    }

    await this.updateOutputs(bucket, prefix, nextToken);

    return nextToken;
  }

  collectResults(data) {
    if (!this.modelMetadata) {
      this.modelMetadata = this.parseModelMetadata(data);
    }

    const parsed = this.parseResults(data);
    this.dataset = this.dataset.concat(parsed);

    const uniques = this.getUniqueNames(parsed);

    this.mapData = this.mapData.concat(uniques);
    this.mapData = [
      ...new Set(this.mapData),
    ];

    return data.NextToken;
  }

  parseModelMetadata(dataset) {
    return {
      VideoMetadata: dataset.VideoMetadata,
    };
  }

  async updateOutputs(bucket, prefix, nextToken) {
    return Promise.all([
      this.updateDataFile(bucket, prefix, DATA_FILENAME, this.dataset, nextToken),
      this.updateMapFile(bucket, prefix, MAP_FILENAME, this.mapData, DATA_FILENAME),
    ]);
  }

  getUniqueNames(dataset) {
    throw new M2CException('subclass to implement getUniqueNames');
  }

  getRunCommand(params) {
    throw new M2CException('subclass to implement getRunCommand');
  }

  async getDetectionResults(params) {
    const rekognitionClient = xraysdkHelper(new RekognitionClient({
      customUserAgent: CUSTOM_USER_AGENT,
      retryStrategy: retryStrategyHelper(),
    }));

    const command = this.getRunCommand(params);

    return rekognitionClient.send(command)
      .then((res) => ({
        ...res,
        $metadata: undefined,
      }))
      .catch((e) => {
        console.error(
          'ERR:',
          'BaseCollectResultsIterator.getDetectionResults:',
          `${command.constructor.name}:`,
          e.$metadata.httpStatusCode,
          e.name,
          e.message,
          JSON.stringify(command.input)
        );
        throw e;
      });
  }

  parseResults(dataset) {
    return dataset[this.namedKey];
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
    dataset,
    nextToken
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

    if (nextToken === undefined) {
      merged = await this.postProcessAllResults(merged);
    }

    return CommonUtils.uploadFile(
      bucket,
      prefix,
      name,
      merged
    ).catch((e) =>
      console.error(e));
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
    const prefix = this.makeRawDataPrefix(this.subCategory);
    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    data.output = PATH.join(prefix, MAP_FILENAME);
    this.stateData.setCompleted();
    return this.stateData.toJSON();
  }

  setProgress(pencentage) {
    this.stateData.setProgress(pencentage);
    return this.stateData.toJSON();
  }

  static computeSampling(dataset) {
    if (!dataset.length || dataset[0].Timestamp === undefined) {
      return undefined;
    }

    /* take the first 200 samples */
    const samples = dataset.slice(0, 200);

    const timestamps = [
      ...new Set(samples
        .map((x) =>
          x.Timestamp)),
    ].sort((a, b) =>
      a - b);

    const diffs = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      diffs.push(timestamps[i + 1] - timestamps[i]);
    }
    const max = Math.round(Math.max(...diffs));
    return Math.max(
      Math.min(
        max,
        MAX_SAMPLING_RATE
      ),
      MIN_SAMPLING_RATE
    );
  }

  async postProcessAllResults(data) {
    return data;
  }
}

module.exports = BaseCollectResultsIterator;
