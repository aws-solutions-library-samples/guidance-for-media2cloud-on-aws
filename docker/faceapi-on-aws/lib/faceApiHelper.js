// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');

const MODELPATH = process.env.MODEL_PATH;
const MINCONFIDENCE = 0.50;
const MAXRESULTS = 20;

let OptionsSSDMobileNet;

async function _loadModel(modelPath = MODELPATH) {
  const {
    nets: {
      ssdMobilenetv1,
      ageGenderNet,
      faceLandmark68Net,
      faceRecognitionNet,
      faceExpressionNet,
    },
    tf: {
      setBackend,
      ready,
    }
  } = faceapi;

  console.log('Loading tensorflow backend');

  const t0 = Date.now();

  await setBackend('tensorflow');
  await ready();

  console.log('Loading FaceAPI models');

  let promises = [];

  for (const model of [ssdMobilenetv1, ageGenderNet, faceLandmark68Net, faceRecognitionNet, faceExpressionNet]) {
    promises.push(model.loadFromDisk(modelPath));
  }
  promises = await Promise.all(promises);

  const t1 = Date.now();

  console.log(`Initialization elapsed = ${t1 - t0}ms`);

  return promises;
}

async function _detectFaces(buf, minConfidence = MINCONFIDENCE, maxResults = MAXRESULTS) {
  let tensor;
  try {
    tensor = _toTensor(buf);

    if (OptionsSSDMobileNet === undefined) {
      OptionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({
        minConfidence,
        maxResults,
      });
    }

    const response = await faceapi
      .detectAllFaces(tensor, OptionsSSDMobileNet)
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors()
      .withAgeAndGender();

    let imageWxH = [0, 0];
    const faces = [];

    for (const face of response) {
      const {
        detection: {
          imageWidth: imgW,
          imageHeight: imgH,
          box,
          score,
        },
        gender,
        genderProbability,
        expressions,
        angle: pose,
        age,
        descriptor,
      } = face;

      let { top, left, width, height } = box;

      if (imageWxH[0] === 0 || imageWxH[1] === 0) {
        imageWxH = [imgW, imgH];
      }

      // checking out-of-bound bbox
      if ((left + width) > imgW) {
        width = imgW - left - 2;
      }
      if ((top + height) > imgH) {
        height = imgH - top - 2;
      }
      if (width <= 0 || height <= 0) {
        continue;
      }

      const emotions = expressions.asSortedArray()
        .filter((emotion) =>
          emotion.probability > 0.10)
        .map((emotion) => ({
          name: emotion.expression,
          score: emotion.probability,
        }));

      const t = top / imgH;
      const l = left / imgW;
      const w = width / imgW;
      const h = height / imgH;

      const embedding = Array.from(descriptor);

      faces.push({
        box: { t, l, w, h },
        score,
        gender: {
          name: gender,
          score: genderProbability,
        },
        age: Math.round(age),
        pose,
        emotions,
        embedding,
      });
    }

    return { imageWxH, faces };
  } catch (e) {
    console.error(e.message);
    return { imageWxH: [0, 0], faces: [] };
  } finally {
    if (tensor) {
      // avoid memory leak
      tf.dispose(tensor);
    }
  }
}

function _toTensor(buf) {
  const tensor = tf.tidy(() => {
    const decode = faceapi.tf.node.decodeImage(buf, 3);
    let expand;
    if (decode.shape[2] === 4) {
      // rgba? ignore alpha channel
      const channels = faceapi.tf.split(decode, 4, 2);
      const rgb = faceapi.tf.stack([channels[0], channels[1], channels[2]], 2);
      expand = faceapi.tf.reshape(rgb, [1, decode.shape[0], decode.shape[1], 3]);
    } else {
      expand = faceapi.tf.expandDims(decode, 0);
    }
    const cast = faceapi.tf.cast(expand, 'float32');

    // avoid memory leak
    faceapi.tf.dispose([decode, expand]);

    return cast;
  });

  return tensor;
}

////////////////////////////////////////////////////
// Functions to export
////////////////////////////////////////////////////
async function loadModel(modelPath) {
  return _loadModel(modelPath);
}

async function detectFaces(buf, minConfidence, maxResults) {
  return _detectFaces(buf, minConfidence, maxResults);
}

module.exports = {
  loadModel,
  detectFaces,
};
