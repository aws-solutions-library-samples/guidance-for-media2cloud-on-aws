// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const {
  join,
} = require('node:path');
const {
  StateData,
  AnalysisError,
  CommonUtils: {
    download,
    uploadFile,
    deleteObject,
  },
} = require('core-lib');

const DEBUG_LOCAL = (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined);
const JSON_FACEAPI = 'faceapi.json';

class StateRunFaceApiModelCompleted {
  constructor(stateData) {
    if (!(stateData instanceof StateData)) {
      throw new AnalysisError('stateData not StateData object');
    }
    this.$stateData = stateData;
  }

  static opSupported(op) {
    return op === 'StateRunFaceApiModelCompleted';
  }

  get [Symbol.toStringTag]() {
    return 'StateRunFaceApiModelCompleted';
  }

  get stateData() {
    return this.$stateData;
  }

  async process() {
    const { input, data } = this.stateData;
    const {
      destination: { bucket },
    } = input;

    let framePrefix;
    let promises = [];
    let frames = [];

    for (const { prefix, output } of data.iterators) {
      if (framePrefix === undefined) {
        framePrefix = prefix;
      }
      promises.push(download(bucket, join(prefix, output))
        .then((res) => {
          const parsed = _formatFaceApiOutput(JSON.parse(res));
          frames = frames.concat(parsed);
        }));
    }
    await Promise.all(promises);
    promises = [];

    // clear up parts
    for (const { prefix, output } of data.iterators) {
      if (output !== JSON_FACEAPI) {
        promises.push(_deleteObject(bucket, join(prefix, output)));
      }
    }
    await Promise.all(promises);
    promises = [];

    frames.sort((a, b) =>
      a.frameNo - b.frameNo);

    if (framePrefix === undefined) {
      return this.setCompleted();
    }

    await uploadFile(bucket, framePrefix, JSON_FACEAPI, frames);

    data.faceapi = {
      prefix: framePrefix,
      output: JSON_FACEAPI,
    };

    return this.setCompleted();
  }

  setCompleted() {
    const {
      data: { faceapi = {} },
    } = this.stateData;

    return { faceapi };
  }
}

async function _deleteObject(bucket, key) {
  if (DEBUG_LOCAL) {
    return true;
  }
  return deleteObject(bucket, key);
}

function _formatFaceApiOutput(data) {
  const frames = [];

  for (const frame of data) {
    const { name, frameNo, timestamp, imageWxH, faces } = frame;
    const [imgW, imgH] = imageWxH;
    const facesInFrame = [];
    for (const face of faces) {
      const {
        box: { t: Top, l: Left, w: Width, h: Height },
        pose: { pitch, roll, yaw },
        score,
        gender,
        age,
        emotions = [],
      } = face;

      const Pitch = Math.round(pitch / 2);
      const Roll = Math.round(roll / 2);
      const Yaw = Math.round(yaw / 2);
      const CenterXY = [Left + (Width / 2), Top + (Height / 2)];
      // format to Rekognition syntax
      const item = {
        Face: {
          Confidence: score * 100,
          BoundingBox: { Top, Left, Width, Height },
          Pose: { Pitch, Roll, Yaw },
          CenterXY,
        }
      };

      // AgeRange
      if (typeof age === 'number') {
        const High = Math.ceil(age / 10) * 10;
        const Low = Math.floor(age / 10) * 10;
        item.Face.AgeRange = { High, Low };
      }

      // Gender
      if (gender !== undefined) {
        let { name, score } = gender;

        if (name === 'male') {
          name = 'Male';
        } else if (name === 'female') {
          name = 'Female';
        }

        item.Face.Gender = { Value: name, Confidence: score * 100 };
      }

      // Emotions
      const emotionItems = [];
      for (const { name, score } of emotions) {
        if (name) {
          emotionItems.push({
            Type: name.toUpperCase(),
            Confidence: score * 100,
          });
        }
      }
      if (emotionItems.length > 0) {
        item.Face.Emotions = emotionItems;
      }

      facesInFrame.push(item);
    }
    frames.push({ name, frameNo, timestamp, imageWxH, faces: facesInFrame });
  }

  return frames;
}

module.exports = StateRunFaceApiModelCompleted;
