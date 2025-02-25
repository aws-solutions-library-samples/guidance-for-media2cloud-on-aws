// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  parse,
  join,
} = require('node:path');
const {
  CommonUtils: {
    download,
    uploadFile,
  }
} = require('core-lib');
const BaseState = require('../shared/base');

const MAXCONCURRENCY = 5;
const MAXFACESPERINDEX = 21; // 270x360 [1890x1080] (compose 21 faces per image)

class StatePrepareFaceIndexingIterators extends BaseState {
  async process() {
    console.log(`event = ${JSON.stringify(this.event)}`);

    //
    // Prepare iterators to run FaceApi model
    //
    const {
      input: { bucket, prefix, output },
      data,
    } = this.event;

    data.iterators = [];

    const items = await download(bucket, join(prefix, output))
      .then((res) =>
        JSON.parse(res));

    // maximize the concurrency
    let itemsPerIterator = Math.ceil(items.length / MAXCONCURRENCY);
    itemsPerIterator = Math.ceil(itemsPerIterator / MAXFACESPERINDEX) * MAXFACESPERINDEX;

    const iterators = [];
    while (items.length) {
      const sliced = items.splice(0, itemsPerIterator);
      iterators.push(sliced);
    }

    if (iterators.length === 0) {
      return this.event;
    }

    const filterSettings = { minConfidence: 0.10, maxResults: 1 };

    if (iterators.length === 1) {
      data.iterators.push({
        operation: 'StateIndexFacesToCollection',
        bucket,
        prefix,
        output,
        filterSettings,
      });
      return this.event;
    }

    const basename = parse(output).name;

    let promises = [];
    for (let i = 0; i < iterators.length; i += 1) {
      const iterator = iterators[i];
      const name = `${basename}-${i}.json`;

      promises.push(uploadFile(bucket, prefix, name, iterator)
        .then(() => {
          data.iterators.push({
            operation: 'StateIndexFacesToCollection',
            bucket,
            prefix,
            output: name,
            filterSettings,
          });
        }));
    }
    promises = await Promise.all(promises);

    return this.event;
  }
}

module.exports = StatePrepareFaceIndexingIterators;
