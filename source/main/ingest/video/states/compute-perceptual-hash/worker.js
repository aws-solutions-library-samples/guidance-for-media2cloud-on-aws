// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const PATH = require('path');
const {
  workerData,
  parentPort,
} = require('worker_threads');
const {
  CommonUtils,
  JimpHelper: {
    imageFromS3,
    computeHash,
    computeLaplacianVariance,
  },
} = require('core-lib');

async function computeImageProps(data, frameHashes) {
  const bucket = data.bucket;
  const prefix = data.prefix;

  const size = frameHashes.length;

  for (let i = data.startIdx; i < size; i += data.step) {
    const frame = frameHashes[i];

    if (frame.hash !== undefined) {
      continue;
    }

    // eslint-disable-next-line
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const key = PATH.join(prefix, frame.name);
    const image = await imageFromS3(bucket, key)
      .catch((e) => {
        console.error(
          'ERR:',
          'JimpHelper.imageFromS3:',
          frame.name,
          e.message
        );
        return undefined;
      });

    let hash = 'undefined';
    let laplacian = 0;

    if (image) {
      [
        hash,
        laplacian,
      ] = await Promise.all([
        computeHash(image),
        computeLaplacianVariance(image),
      ]);
    }

    // post message to parent
    parentPort.postMessage({
      idx: i,
      hash,
      laplacian,
    });

    // quit if lambda approaching timeout
    if ((data.deadline - Date.now()) < 500) {
      break;
    }
  }
}

(async () => {
  try {
    console.log('workerData', JSON.stringify(workerData, null, 2));

    const missing = ['bucket', 'prefix', 'name', 'startIdx', 'step', 'deadline']
      .filter((x) =>
        workerData[x] === undefined);

    if (missing.length) {
      throw new Error(`missing workerData (${missing.join(', ')})`);
    }

    const bucket = workerData.bucket;
    const prefix = workerData.prefix;
    const name = workerData.name;
    const key = PATH.join(prefix, name);

    const frameHashes = await CommonUtils.download(bucket, key)
      .then((res) =>
        JSON.parse(res))
      .catch(() =>
        ([]));

    await computeImageProps(workerData, frameHashes);
  } catch (e) {
    console.error(e);
    console.log('workerData', JSON.stringify(workerData, null, 2));
    parentPort.postMessage({
      ...workerData,
      error: e.message,
    });
  }
})();
