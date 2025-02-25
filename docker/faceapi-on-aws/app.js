// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  parse,
  join,
} = require('node:path');
const {
  readFileSync,
} = require('node:fs');
const {
  loadModel,
  detectFaces,
} = require('./lib/faceApiHelper');
const {
  download,
  upload,
  lambdaTimeout,
} = require('./lib/utils');

const DEBUG_LOCAL = (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined);
const BAILOUT_RETRY = 10;

exports.handler = async (event, context) => {
  try {
    // test mode
    if (event.localFile) {
      return _testMode(event.localFile);
    }

    const {
      bucket,
      prefix,
      output,
      filterSettings,
      retries,
    } = event;

    if (event.startTime === undefined) {
      event.startTime = Date.now();
    }

    if (retries && retries >= BAILOUT_RETRY) {
      throw new Error('Too many retries');
    }

    const imageList = await download(bucket, join(prefix, output))
      .then((res) =>
        JSON.parse(res));

    let toBeProcessed = imageList.filter((x) =>
      x.faces === undefined);

    if (DEBUG_LOCAL) {
      toBeProcessed = imageList.slice();
    }

    if (toBeProcessed.length === 0) {
      return _setCompleted(event);
    }

    await loadModel();

    for (const item of toBeProcessed) {
      const { key } = item;

      const image = await _loadImage(bucket, key);

      const t0 = Date.now();

      const response = await _detectFaces(image, filterSettings);
      for (const [k, v] of Object.entries(response)) {
        item[k] = v;
      }

      const t1 = Date.now();
      console.log(`PROCESSED ${parse(key).base} [${item.imageWxH[0]}x${item.imageWxH[1]}]: Found ${item.faces.length} faces. (${t1 - t0}ms)`);

      if (lambdaTimeout(context)) {
        break;
      }
    }

    const outFiles = [
      [prefix, output, imageList],
    ];

    let promises = [];
    for (const [outPrefix, name, data] of outFiles) {
      promises.push(upload(bucket, outPrefix, name, data));
    }
    await Promise.all(promises);

    const remaining = imageList.filter((x) =>
      x.faces === undefined);

    if (remaining.length === 0) {
      return _setCompleted(event);
    }

    let percentage = (imageList.length - remaining.length) / imageList.length;
    percentage = Math.round(percentage * 100);

    return _setProgress(event, percentage);
  } catch (e) {
    console.log(e);
    throw e;
  }
};

async function _testMode(file) {
  const buf = readFileSync(file);

  await loadModel();
  const response = await detectFaces(buf);

  return response;
}

function _setCompleted(event) {
  event.endTime = Date.now();
  event.faceApiStatus = 'COMPLETED';
  delete event.retries;
  return event;
}

function _setProgress(event, percentage) {
  event.faceApiStatus = 'IN_PROGRESS';
  event.progress = percentage;

  if (event.retries === undefined) {
    event.retries = 0;
  }
  event.retries += 1;

  return event;
}

async function _loadImage(bucket, key) {
  let image = await download(bucket, key, false)
    .then((res) =>
      res.Body.transformToByteArray());

  image = await image;

  return Buffer.from(image);
}

async function _detectFaces(image, filterSettings = {}) {
  const {
    minConfidence, // 0.50
    maxResults, // 20
    minFaceW = 0,
    minFaceH = 0,
    maxPitch = 0,
    maxRoll = 0,
    maxYaw = 0,
  } = filterSettings;

  const response = await detectFaces(image, minConfidence, maxResults);

  const {
    imageWxH: [imgW, imgH],
    faces,
  } = response;

  const qualified = [];

  for (const face of faces) {
    const {
      box: { w, h },
      pose: { pitch, roll, yaw },
    } = face;

    const faceW = w * imgW;
    const faceH = h * imgH;

    if (minFaceW > 0 && faceW < minFaceW) {
      continue;
    }
    if (minFaceH > 0 && faceH < minFaceH) {
      continue;
    }
    if (maxPitch > 0 && Math.abs(pitch) > maxPitch) {
      continue;
    }
    if (maxRoll > 0 && Math.abs(roll) > maxRoll) {
      continue;
    }
    if (maxYaw > 0 && Math.abs(yaw) > maxYaw) {
      continue;
    }

    // delete face embedding
    delete face.embedding;

    qualified.push(face);
  }

  console.log(`Reduced faces: ${faces.length} -> ${qualified.length}`);

  return { imageWxH: [imgW, imgH], faces: qualified };
}
