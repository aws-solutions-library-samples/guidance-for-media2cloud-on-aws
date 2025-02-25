// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  parse,
  join,
} = require('node:path');
const {
  StateData,
  AnalysisError,
  AnalysisTypes: {
    Rekognition: {
      Celeb,
      FaceMatch,
    },
  },
  CommonUtils: {
    download,
    uploadFile,
  },
} = require('core-lib');

const { Statuses: { Completed } } = StateData;

const FRAMECAPTUREGROUP = 'frameCapture';
const JSON_FRAMEHASH = 'frameHash.json';
const JSON_FACEAPI = 'faceapi.json';
const MAXFRAMES_PER_ITERATOR = 1200;

class StatePrepareFaceApiModelIterators {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  static opSupported(op) {
    return op === 'StatePrepareFaceApiModelIterators';
  }

  get [Symbol.toStringTag]() {
    return 'StatePrepareFaceApiModelIterators';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const { input, data } = this.stateData;
    const {
      aiOptions: { framebased, [Celeb]: celeb, [FaceMatch]: facematch },
    } = input;

    if (!framebased || (!celeb && !facematch)) {
      return this.setCompleted();
    }

    const {
      destination: { bucket, prefix },
      video: { key: videoKey },
    } = input;

    const framePrefix = join(parse(videoKey).dir, '..', FRAMECAPTUREGROUP);

    const items = await download(bucket, join(framePrefix, JSON_FRAMEHASH))
      .then((res) =>
        JSON.parse(res));

    // maximize the concurrency
    let itemsPerIterator = MAXFRAMES_PER_ITERATOR;
    const nIterators = Math.ceil(items.length / MAXFRAMES_PER_ITERATOR);
    if (nIterators > 1) {
      itemsPerIterator = Math.ceil(items.length / nIterators);
    }

    const iterators = [];
    while (items.length > 0) {
      const sliced = items.splice(0, itemsPerIterator);
      for (const item of sliced) {
        item.key = join(framePrefix, item.name);
        delete item.hash;
        delete item.laplacian;
      }
      iterators.push(sliced);
    }

    data.iterators = [];

    if (iterators.length === 0) {
      return this.setCompleted();
    }

    const filterSettings = { minConfidence: 0.05, maxResults: 5 };

    if (iterators.length === 1) {
      const iterator = iterators[0];
      const name = JSON_FACEAPI;

      await uploadFile(bucket, framePrefix, name, iterator)
        .then(() => {
          data.iterators.push({
            bucket,
            prefix: framePrefix,
            output: name,
            filterSettings,
          });
        });
      return this.setCompleted();
    }

    let promises = [];
    const basename = parse(JSON_FACEAPI).name;

    for (let i = 0; i < iterators.length; i += 1) {
      const iterator = iterators[i];
      const name = `${basename}-${i}.json`;

      promises.push(uploadFile(bucket, framePrefix, name, iterator)
        .then(() => {
          data.iterators.push({
            bucket,
            prefix: framePrefix,
            output: name,
            filterSettings,
          });
        }));
    }
    promises = await Promise.all(promises);

    return this.setCompleted();
  }

  setCompleted() {
    const { data } = this.stateData;
    if (data.iterators === undefined) {
      data.iterators = [];
    }
    this.stateData.status = Completed;

    return this.stateData.toJSON();
  }
}

module.exports = StatePrepareFaceApiModelIterators;
