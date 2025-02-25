// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  join,
} = require('node:path');
const {
  CommonUtils: {
    download,
    uploadFile,
    deleteObject,
  },
} = require('core-lib');
const BaseState = require('../shared/base');

const DEBUG_LOCAL = (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined);

class StateFaceIndexingIteratorsCompleted extends BaseState {
  async process() {
    console.log(`event = ${JSON.stringify(this.event)}`);

    const { input, data } = this.event;
    const { bucket, prefix } = input;

    let promises = [];
    let items = [];
    const faceUndetected = [];
    const faceUnindexed = [];

    for (const { output } of data.iterators) {
      promises.push(download(bucket, join(prefix, output))
        .then((res) => {
          const parsed = JSON.parse(res);
          items = items.concat(parsed);
        }));
    }
    await Promise.all(promises);
    promises = [];

    // clear up parts
    for (const { output } of data.iterators) {
      if (output !== input.output) {
        promises.push(_deleteObject(bucket, join(prefix, output)));
      }
    }
    await Promise.all(promises);
    promises = [];

    for (const item of items) {
      if (promises.length >= 50) {
        await Promise.all(promises);
        promises = [];
      }

      const { key, name, faces, faceId, errorMessage } = item;
      if (faceId === undefined) {
        if (errorMessage) {
          faceUnindexed.push({ key, name, reason: errorMessage });
        } else if (faces.length === 0) {
          faceUndetected.push({ key, name, reason: 'Face not detected' });
        }
      }

      // clean up uploaded images
      promises.push(_deleteObject(bucket, key));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      promises = [];
    }

    const { output } = input;
    await uploadFile(bucket, prefix, output, items);

    data.total = items.length;
    data.unprocessed = faceUndetected.length + faceUnindexed.length;
    data.processed = data.total - data.unprocessed;
    data.faceUndetected = faceUndetected;
    data.faceUnindexed = faceUnindexed;

    delete data.iterators;

    return this.event;
  }
}

async function _deleteObject(bucket, key) {
  if (DEBUG_LOCAL) {
    return true;
  }
  return deleteObject(bucket, key);
}

module.exports = StateFaceIndexingIteratorsCompleted;
